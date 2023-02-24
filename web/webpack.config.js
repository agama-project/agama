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
const StylelintPlugin = require('stylelint-webpack-plugin');
const TsconfigPathsPlugin = require('tsconfig-paths-webpack-plugin');
const ReactRefreshWebpackPlugin = require('@pmmmwh/react-refresh-webpack-plugin');

/* A standard nodejs and webpack pattern */
const production = process.env.NODE_ENV === 'production';
const development = !production;

/* development options for faster iteration */
const eslint = process.env.ESLINT !== '0';

/* Default to disable csslint for faster production builds */
const stylelint = process.env.STYLELINT ? (process.env.STYLELINT !== '0') : development;

// Cockpit target managed by the development server
let cockpitTarget = process.env.COCKPIT_TARGET;

if (cockpitTarget) {
  // add the default port if not specified
  if (cockpitTarget.indexOf(":") === -1) {
    cockpitTarget += ":9090";
  }

  cockpitTarget = "https://" + cockpitTarget;
}
else {
  // by default connect to a locally running Cockpit
  cockpitTarget = "https://localhost:9090";
}

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
  development && new ReactRefreshWebpackPlugin({ overlay: false }),
].filter(Boolean);

if (eslint) {
  plugins.push(new ESLintPlugin({ extensions: ["js", "jsx"], failOnWarning: true, }));
}

if (stylelint) {
  plugins.push(new StylelintPlugin({
    context: "src/",
  }));
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
    reactRefreshSetup: '@pmmmwh/react-refresh-webpack-plugin/client/ReactRefreshEntry.js',
    index: ["./src/index.js"],
  },
  // cockpit.js gets included via <script>, everything else should be bundled
  externals: { cockpit: "cockpit" },
  devServer: {
    hot: true,
    // forward all cockpit connections to a real Cockpit instance
    proxy: {
      "/cockpit": {
        target: cockpitTarget,
        // redirect also the websocket connections
        ws: true,
        // ignore SSL problems (self-signed certificate)
        secure: false,
      },
    },
    // use https so Cockpit uses wss:// when connecting to the backend
    server: "https",
    // hot replacement does not support wss:// transport when running over https://,
    // as a workaround use sockjs (which uses standard https:// protocol)
    webSocketServer: "sockjs",
  },
  devtool: "source-map",
  stats: "errors-warnings",
  // always regenerate dist/, so make rules work
  output: { clean: true, compareBeforeEmit: false },

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
        test: /\.(js|jsx)$/,
        exclude: /node_modules/,
        use: [
          {
            loader: "babel-loader",
            options: {
              plugins: [development && require.resolve('react-refresh/babel')].filter(Boolean),
            },
          }
        ]
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
              sourceMap: development,
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
