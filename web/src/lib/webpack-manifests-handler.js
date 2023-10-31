const fs = require("fs");
const path = require("path");

const manifestFile = path.join(__dirname, "..", "manifest.json");

// this function is injected as a string into the resulting JS file
const updateAgamaManifest = (data) => {
  if (typeof cockpit === "object" && cockpit.manifests) {
    cockpit.manifests.agama = data;
  }
};

// This function processes the webpack HTTP proxy request for manifests.js file.
//
// Patching the original JS code is difficult so rather inject code
// which rewrites the Agama manifest data with new content.
//
// @see https://github.com/http-party/node-http-proxy#modify-response
//
// @param proxyRes HTTP proxy resource
// @param req HTTP request
// @param res HTTP response
module.exports = function (proxyRes, req, res) {
  // collect parts of the original response
  const body = [];

  proxyRes.on("data", function (chunk) {
    body.push(chunk);
  });

  proxyRes.on("end", function () {
    // forward the original status code
    res.statusCode = proxyRes.statusCode;

    // patch the response only on success otherwise there
    // might be some unexpected content (HTML error page)
    if (proxyRes.statusCode === 200 && fs.existsSync(manifestFile)) {
      const manifest = fs.readFileSync(manifestFile);
      // use an immediately-invoked function expression to inject the new
      // manifest content
      res.end(Buffer.concat(body).toString() + "((" +
        updateAgamaManifest.toString() + ")(" + manifest + "));");
    } else {
      // otherwise just return the original content
      res.end(Buffer.concat(body).toString());
    }
  });
};
