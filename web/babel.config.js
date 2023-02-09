const { NODE_ENV } = process.env;

const presets = [
  '@babel/preset-react',
  ['@babel/preset-env', { targets: { node: 'current' } }]
];
const plugins = [];

if (NODE_ENV === 'development') {
  plugins.push('react-refresh/babel');
}

module.exports = {
  presets,
  plugins
};
