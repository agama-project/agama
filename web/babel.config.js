module.exports = {
  presets: [
    '@babel/preset-react',
    ['@babel/preset-env', {targets: {node: 'current'}}]
  ],
  plugins: [
    'react-refresh/babel',
  ]
};
