/*
 * Copyright (c) [2023] SUSE LLC
 *
 * All Rights Reserved.
 *
 * This program is free software; you can redistribute it and/or modify it
 * under the terms of version 2 of the GNU General Public License as published
 * by the Free Software Foundation.
 *
 * This program is distributed in the hope that it will be useful, but WITHOUT
 * ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or
 * FITNESS FOR A PARTICULAR PURPOSE.  See the GNU General Public License for
 * more details.
 *
 * You should have received a copy of the GNU General Public License along
 * with this program; if not, contact SUSE LLC.
 *
 * To contact SUSE LLC about this file by physical or electronic mail, you may
 * find current contact information at www.suse.com.
 */

// names of all translation functions
const translations = ["_", "n_", "N_", "Nn_"];
// names of the plural translation functions
const plurals = ["n_", "Nn_"];

const errorMsgLiteral = "Use a string literal argument in the translation functions";
const errorMsgMissing = "Missing argument";

/**
 * Check whether the AST tree node is a string literal
 * @param {Object} node the node
 * @returns {boolean} true if the node is a string literal
 */
function isStringLiteral(node) {
  if (!node) return false;

  return node.type === "Literal" && (typeof node.value === "string");
}

/**
 * Check whether the ATS node is a string literal
 * @param {Object} node the node to check
 * @param {Object} parentNode parent node for reporting error if `node` is undefined
 * @param {Object} context the context for reporting an error
 */
function checkNode(node, parentNode, context) {
  if (node) {
    // string literal?
    if (!isStringLiteral(node)) {
      context.report(node, errorMsgLiteral);
    }
  } else {
    // missing argument
    context.report(parentNode, errorMsgMissing);
  }
}

// define the eslint rule
module.exports = {
  meta: {
    type: "problem",
    docs: {
      description: "Check that only string literals are passed to the translation functions.",
    },
  },
  create: function (context) {
    return {
      // callback for handling function calls
      CallExpression(node) {
        // not a translation function, skip it
        if (!translations.includes(node.callee.name)) return;

        // check the first argument
        checkNode(node.arguments[0], node, context);

        // check also the second argument for the plural forms
        if (plurals.includes(node.callee.name)) {
          checkNode(node.arguments[1], node, context);
        }
      }
    };
  }
};
