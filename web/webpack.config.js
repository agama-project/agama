const fs = require("fs");
const path = require("path");

const Copy = require("copy-webpack-plugin");
const Extract = require("mini-css-extract-plugin");
const TerserJSPlugin = require('terser-webpack-plugin');
const CssMinimizerPlugin = require('css-minimizer-webpack-plugin');
const CompressionPlugin = require("compression-webpack-plugin");
const ESLintPlugin = require('eslint-webpack-plugin');
const CockpitPoPlugin = require("./src/lib/cockpit-po-plugin");
const CockpitRsyncPlugin = require("./src/lib/cockpit-rsync-plugin");
const TsconfigPathsPlugin = require('tsconfig-paths-webpack-plugin');

/* A standard nodejs and webpack pattern */
const production = process.env.NODE_ENV === 'production';

/* development options for faster iteration */
const eslint = process.env.ESLINT !== '0';

// Obtain package name from package.json
const packageJson = JSON.parse(fs.readFileSync('package.json'));

// Non-JS files which are copied verbatim to dist/
const copy_files = [
  "./src/index.html",
  "./src/manifest.json",
  // TODO: consider using something more complete like https://github.com/jantimon/favicons-webpack-plugin
  "./src/assets/favicon.svg",
];

const plugins = [
  new Copy({ patterns: copy_files }),
  new Extract({ filename: "[name].css" }),
  new CockpitPoPlugin(),
  new CockpitRsyncPlugin({ dest: packageJson.name }),
];

if (eslint) {
  plugins.push(new ESLintPlugin({ extensions: ["js", "jsx"], failOnWarning: true, }));
}

/* Only minimize when in production mode */
if (production) {
  plugins.unshift(new CompressionPlugin({
    test: /\.(js|html|css)$/,
    deleteOriginalAssets: true
  }));
}

module.exports = {
  mode: production ? 'production' : 'development',
  resolve: {
    modules: ["node_modules", path.resolve(__dirname, 'src/lib')],
    plugins: [new TsconfigPathsPlugin({ extensions: [".js", ".jsx", ".json"] })],
    extensions: ['', '.js', '.json', '.jsx']
  },
  resolveLoader: {
    modules: ["node_modules", path.resolve(__dirname, 'src/lib')],
  },
  watchOptions: {
    ignored: /node_modules/,
  },
  entry: {
    index: "./src/index.js",
  },
  // cockpit.js gets included via <script>, everything else should be bundled
  externals: { cockpit: "cockpit" },
  devtool: "source-map",
  stats: "errors-warnings",

  optimization: {
    minimize: production,
    minimizer: [
      new TerserJSPlugin({
        extractComments: {
          condition: true,
          filename: `[file].LICENSE.txt?query=[query]&filebase=[base]`,
          banner(licenseFile) {
            return `License information can be found in ${licenseFile}`;
          },
        },
      }),
      new CssMinimizerPlugin()
    ],
  },

  module: {
    rules: [
      {
        exclude: /node_modules/,
        use: "babel-loader",
        test: /\.(js|jsx)$/
      },
      {
        test: /\.s?css$/,
        use: [
          Extract.loader,
          {
            loader: 'css-loader',
            options: {
              sourceMap: true,
              url: {
                // Only follow D-Installer fonts links to be processed by the next rule and place
                // them in dist/fonts
                filter: (url) => url.includes("./fonts/")
              }
            }
          },
          {
            loader: 'sass-loader',
            options: {
              sourceMap: !production,
              sassOptions: {
                includePaths: ["node_modules"],
                outputStyle: production ? 'compressed' : undefined,
              },
            },
          },
        ]
      },
      {
        test: /\.(eot|ttf|woff|woff2)$/,
        type: 'asset/resource',
        generator: {
          filename: 'fonts/[name][ext]',
        }
      },
      // Load SVG files
      {
        test: /\.svg$/i,
        type: 'asset',
        resourceQuery: { not: [/component/] } // exclude file import includes ""?component"
      },
      {
        test: /\.svg$/i,
        issuer: /\.jsx?$/,
        resourceQuery: /component/, // *.svg?component
        use: ['@svgr/webpack']
      }
    ]
  },
  plugins: plugins
};
