#! /usr/bin/env node

// Helper script for converting Gettext PO file to Javascript so they can loaded
// by the web frontend.
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

// extract the plural form function
function pluralForm(statement) {
  try {
    // try parsing the plural form function definition string to ensure it is valid, the jed parser
    // contains a full parser for the Gettext plural forms definitions and avoids using eval() which
    // is insecure for 3rd party files
    jed.PF.parse(statement);
  } catch (error) {
    console.error("Invalid plural form definition", statement)
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

Promise.all(poFiles().map((f) => buildFile(f)));
