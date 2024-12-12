const fs = require("fs");
const path = require("path");

const Copy = require("copy-webpack-plugin");
const Extract = require("mini-css-extract-plugin");
const TerserJSPlugin = require("terser-webpack-plugin");
const CssMinimizerPlugin = require("css-minimizer-webpack-plugin");
const HtmlMinimizerPlugin = require("html-minimizer-webpack-plugin");
const CompressionPlugin = require("compression-webpack-plugin");
const ESLintPlugin = require("eslint-webpack-plugin");
const StylelintPlugin = require("stylelint-webpack-plugin");
const TsconfigPathsPlugin = require("tsconfig-paths-webpack-plugin");
const ReactRefreshWebpackPlugin = require("@pmmmwh/react-refresh-webpack-plugin");
const ReactRefreshTypeScript = require("react-refresh-typescript");
const webpack = require("webpack");

/* A standard nodejs and webpack pattern */
const production = process.env.NODE_ENV === "production";
const development = !production;

/* development options for faster iteration */
const eslint = process.env.ESLINT !== "0";

/* Default to disable csslint for faster production builds */
const stylelint = process.env.STYLELINT ? process.env.STYLELINT !== "0" : development;

// Agama API server. By default it connects to a local development server.
let agamaServer = process.env.AGAMA_SERVER || "localhost";
if (!agamaServer.startsWith("http")) {
  agamaServer = "http://" + agamaServer;
}

// Obtain package name from package.json
const packageJson = JSON.parse(fs.readFileSync("package.json"));

// Non-JS files which are copied verbatim to dist/
const copy_files = [
  "./src/index.html",
  // TODO: consider using something more complete like https://github.com/jantimon/favicons-webpack-plugin
  "./src/assets/favicon.svg",
  "./src/languages.json",
  { from: "./src/assets/products/*.svg", to: "assets/logos/[name][ext]" },
];

const plugins = [
  new Copy({ patterns: copy_files }),
  new Extract({ filename: "[name].css" }),
  development && new ReactRefreshWebpackPlugin({ overlay: false }),
  // replace the "process.env.WEBPACK_SERVE" text in the source code by
  // the current value of the environment variable, that variable is set to
  // "true" when running the development server ("npm run server")
  // https://webpack.js.org/plugins/environment-plugin/
  new webpack.EnvironmentPlugin({ WEBPACK_SERVE: null, LOCAL_CONNECTION: null }),
  new webpack.SourceMapDevToolPlugin({
    filename: "[file].map",
    // skip the source maps for the translation files, they are twice (!) big as the JS files
    // themselves and do not provide any value because there are basically just arrays of texts
    exclude: /po-.*\.js$/,
  }),
].filter(Boolean);

if (eslint) {
  plugins.push(
    new ESLintPlugin({
      configType: "flat",
      extensions: ["js", "jsx", "ts", "tsx"],
      failOnWarning: true,
    }),
  );
}

if (stylelint) {
  plugins.push(
    new StylelintPlugin({
      context: "src/",
    }),
  );
}

/* Only minimize when in production mode */
if (production) {
  plugins.unshift(
    new CompressionPlugin({
      test: /\.(js|html|css)$/,
      deleteOriginalAssets: false,
    }),
  );
}

module.exports = {
  mode: production ? "production" : "development",
  resolve: {
    modules: ["node_modules", path.resolve(__dirname, "src/lib")],
    plugins: [new TsconfigPathsPlugin({ extensions: [".ts", ".tsx", ".js", ".jsx", ".json"] })],
    extensions: [".ts", ".tsx", ".js", ".jsx", ".json"],
  },
  resolveLoader: {
    modules: ["node_modules", path.resolve(__dirname, "src/lib")],
  },
  watchOptions: {
    ignored: /node_modules/,
  },
  entry: {
    index: ["./src/index.js"],
  },
  devServer: {
    hot: true,
    proxy: [
      {
        context: ["/api/ws"],
        target: agamaServer.replace(/^http/, "ws"),
        ws: true,
        secure: false,
      },
      {
        context: ["/api"],
        target: agamaServer,
        secure: false,
      },
    ],
  },
  // source maps are configured using the SourceMapDevToolPlugin above
  devtool: false,
  stats: "errors-warnings",
  // always regenerate dist/, so make rules work
  output: { clean: true, compareBeforeEmit: false },

  optimization: {
    minimize: production,
    minimizer: [
      new TerserJSPlugin({
        // src/components/core/Page.jsx is using a type?.name.endsWith("PageMenu") for extracting page menus.
        // Thus, it's needed not mangling function names ending in PageMenu to keep it working in production
        // until adopting a better solution, if any.
        terserOptions: {
          keep_fnames: /PageMenu$/,
        },
        extractComments: {
          condition: true,
          filename: `[file].LICENSE.txt?query=[query]&filebase=[base]`,
          banner(licenseFile) {
            return `License information can be found in ${licenseFile}`;
          },
        },
      }),
      // remove also the spaces between the tags
      new HtmlMinimizerPlugin({ minimizerOptions: { conservativeCollapse: false } }),
      new CssMinimizerPlugin(),
    ],
  },

  module: {
    rules: [
      {
        test: /\.[jt]sx?$/,
        exclude: /node_modules/,
        use: [
          {
            loader: "babel-loader",
            options: {
              plugins: [development && require.resolve("react-refresh/babel")].filter(Boolean),
            },
          },
          {
            loader: require.resolve("ts-loader"),
            options: {
              getCustomTransformers: () => ({
                before: [development && ReactRefreshTypeScript()].filter(Boolean),
              }),
              transpileOnly: development,
            },
          },
        ],
      },
      {
        test: /\.s?css$/,
        use: [
          Extract.loader,
          {
            loader: "css-loader",
            options: {
              sourceMap: true,
              url: {
                // Only follow the Agama fonts links to be processed by the next rule and place
                // them in dist/fonts
                filter: (url) => url.includes("./fonts/"),
              },
            },
          },
          {
            loader: "sass-loader",
            options: {
              sourceMap: development,
              sassOptions: {
                includePaths: ["node_modules"],
                outputStyle: production ? "compressed" : undefined,
                silenceDeprecations: ["import", "global-builtin"],
              },
            },
          },
        ],
      },
      {
        test: /\.(eot|ttf|woff|woff2)$/,
        type: "asset/resource",
        generator: {
          filename: "fonts/[name][ext]",
        },
      },
      // Load SVG files
      {
        test: /\.svg$/i,
        type: "asset",
        resourceQuery: { not: [/component/] }, // exclude file import includes ""?component"
      },
      {
        test: /\.svg$/i,
        issuer: /\.(j|t)sx?$/,
        resourceQuery: /component/, // *.svg?component
        use: ["@svgr/webpack"],
      },
    ],
  },
  plugins: plugins,
};
