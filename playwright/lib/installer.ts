// shared functions

// return the URL path to the installer plugin
function mainPagePath():string {
  let baseURL = new URL(process.env.BASE_URL || "http://localhost:9090");

  // when running at the default cockpit port use the full cockpit path,
  // otherwise expect the webpack development server where the installer
  // is available at the root path
  return (baseURL.port == "9090") ? "/cockpit/@localhost/d-installer/index.html" : "/";
}

export {
  mainPagePath
};
