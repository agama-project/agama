const HtmlWebpackPlugin = require("html-webpack-plugin");
const path = require("path");
const { ModuleFederationPlugin } = require("webpack").container;
// const deps = require("./package.json").dependencies;

module.exports = {
  mode: "production",
  performance: {
    hints: false,
  },
  entry: "./src/index.tsx",
  output: {
    path: path.resolve(__dirname, "build"),
    filename: "index.js",
    clean: true,
  },
  devServer: {
    port: 3000,
    open: false,
  },
  resolve: {
    extensions: [".ts", ".tsx", ".js"],
  },
  module: {
    rules: [
      {
        test: /\.(js|jsx|tsx|ts)$/,
        loader: "ts-loader",
        exclude: /node_modules/,
      },
    ],
  },
  plugins: [
    new HtmlWebpackPlugin({
      template: `./public/index.html`,
    }),
    new ModuleFederationPlugin({
      name: "plugin",
      filename: "agamaPlugin.js",
      exposes: {
        "./Plugin": "./src/Plugin",
      },
      // shared: {
      //   //...deps,
      //   react: { singleton: true, eager: true, requiredVersion: deps.react },
      //   "react-dom": {
      //     singleton: true,
      //     eager: true,
      //     requiredVersion: deps["react-dom"],
      //   },
      // },
    }),
  ],
};
