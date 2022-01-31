const { createProxyMiddleware } = require('http-proxy-middleware');

module.exports = function(app) {
  app.use(
    createProxyMiddleware(
      '/cockpit/login', {
      target: 'http://localhost:9090',
    })
  );
    })
  );
};
