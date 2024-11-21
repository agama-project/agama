#! /usr/bin/env node

// Helper script for converting Gettext PO files to Javascript so they can be
// loaded by the web frontend.
//
// Inspired by the Cockpit Webpack plugin
// https://github.com/cockpit-project/cockpit/blob/main/pkg/lib/cockpit-po-plugin.js
//
// Usage:
//   cd web/src/po
//   SRCDIR=../../../../agama-weblate/web ../../share/po-converter.js

/* eslint-disable @typescript-eslint/no-require-imports */

const path = require("node:path");
const fs = require("node:fs");
const glob = require("glob");
const gettext_parser = require("gettext-parser");
const jed = require("jed");

const srcdir = process.env.SRCDIR || process.cwd();
const template = fs.readFileSync(path.resolve(__dirname, "po.template.js"), "utf-8");

function poFiles() {
  return glob.sync(path.resolve(srcdir, "*.po"));
}

// read the supported languages from languages.json file
function supportedLanguages() {
  const langs = path.resolve(__dirname, "../src/languages.json");
  const data = JSON.parse(fs.readFileSync(langs, "utf8"));
  return Object.keys(data).map((l) => l.replace("-", "_"));
}

// extract the plural form function
function pluralForm(statement) {
  try {
    // try parsing the plural form function definition string to ensure it is valid, the jed parser
    // contains a full parser for the Gettext plural forms definitions and avoids using eval() which
    // is insecure for 3rd party files
    jed.PF.parse(statement);
  } catch (error) {
    console.error("Invalid plural form definition", statement);
    console.error(error.message);
    process.exit(1);
  }

  const pluralFunc = statement.replace(/nplurals=[1-9]; plural=([^;]*);?$/, "(n) => $1");
  if (pluralFunc === statement) {
    console.error("Cannot extract the plural form function from definition: ", statement);
    process.exit(1);
  }

  return pluralFunc;
}

// convert a single PO file to JS
function buildFile(po_file) {
  return new Promise((resolve, _reject) => {
    const parsed = gettext_parser.po.parse(fs.readFileSync(po_file), "utf8");
    const language = parsed.headers.language;
    // remove the second header copy
    delete parsed.translations[""][""];

    const result = {
      // translations header
      "": {
        "plural-forms": pluralForm(parsed.headers["plural-forms"]),
        language,
      },
    };

    for (const [_msgctxt, context] of Object.entries(parsed.translations)) {
      for (const [msgid, translation] of Object.entries(context)) {
        // ignore fuzzy translations
        if (translation.comments.flag && translation.comments.flag.match(/\bfuzzy\b/)) continue;

        result[msgid] = translation.msgstr;
      }
    }

    // remove the double quotes around the plural forms to convert it from a string to a Javascript
    // function
    const js = JSON.stringify(result, null, 2).replace(
      /"plural-forms": "([^"]+)"/,
      '"plural-forms": $1',
    );

    // inject the result to the template file
    const output = template.replace('"PO_CONTENT"', js);
    fs.writeFileSync(`po.${language}.js`, output);

    resolve();
  });
}

const supported = supportedLanguages();
const files = poFiles().filter((f) => {
  const base = path.basename(f, ".po");
  // full match or language match
  return supported.includes(base) || supported.some((s) => s.split("_")[0] === base);
});

Promise.all(files.map((f) => buildFile(f)));
