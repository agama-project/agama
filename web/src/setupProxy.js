const { createProxyMiddleware } = require("http-proxy-middleware");

module.exports = function (app) {
  app.use(
    createProxyMiddleware("/cockpit/login", {
      target: "http://localhost:9090"
    })
  );
  app.use(
    createProxyMiddleware("/cockpit/socket", {
      target: "ws://localhost:9090",
      ws: true
    })
  );
};
