const fs = require("fs");
const path = require("path");

// Cockpit internally returns the "po.<LANG>.js" file content for the
// "po.js" request, reimplement it with a simple redirection (the JS file
// only exists in the webpack memory, we cannot read it from disk)
//
// This function processes the webpack HTTP request.
//
// @param req HTTP request
// @param res HTTP response
module.exports = function (req, res) {
  // the regexp was taken from the original Cockpit code :-)
  const language = req.headers.cookie.replace(/(?:(?:^|.*;\s*)AgamaLang\s*=\s*([^;]*).*$)|^.*$/, "$1") || "";
  // the cookie uses "pt-br" format while the PO file is "pt_BR" :-/
  let [lang, country] = language.split("-");
  country = country?.toUpperCase();

  // first check the full locale ("pt_BR") PO file
  if (fs.existsSync(path.join(__dirname, "..", "..", "po", `${lang}_${country}.po`))) {
    res.redirect(`/po.${lang}_${country}.js`);
  } else {
    // then check the language part only ("pt") PO file
    if (fs.existsSync(path.join(__dirname, "..", "..", "po", `${lang}.po`))) {
      res.redirect(`/po.${lang}.js`);
    } else {
      if (lang !== "en") console.log(`translation "${language}" not found`);
      // Cockpit returns an empty script if the translation file is missing
      res.set("Content-Type", "application/javascript");
      res.send("");
    }
  }
};
