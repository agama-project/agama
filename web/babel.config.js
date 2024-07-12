const { NODE_ENV } = process.env;

const presets = ["@babel/preset-react", ["@babel/preset-env", { targets: { node: "current" } }]];
const plugins = [];

if (!["production", "test"].includes(NODE_ENV)) {
  plugins.push("react-refresh/babel");
}

module.exports = {
  presets,
  plugins,
};
