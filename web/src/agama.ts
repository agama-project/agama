/*
 * Copyright (c) [2024] SUSE LLC
 *
 * All Rights Reserved.
 *
 * This program is free software; you can redistribute it and/or modify it
 * under the terms of the GNU General Public License as published by the Free
 * Software Foundation; either version 2 of the License, or (at your option)
 * any later version.
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

/**
 * This module provides a global "agama" object which can be use from other
 * scripts like "po.js".
 */

// mapping with the current translations
let translations = {};
// function used for computing the plural form index
let plural_fn: (n: number) => boolean;

const agama = {
  // the current language
  language: "en",

  // set the current translations, called from po.<lang>.js
  locale: (po) => {
    if (po) {
      translations = po;

      const header = po[""];
      if (header) {
        if (header["plural-forms"]) plural_fn = header["plural-forms"];
        if (header.language) agama.language = header.language;
      }
    } else if (po === null) {
      translations = {};
      plural_fn = undefined;
      agama.language = "en";
    }
  },

  /**
   * Get a translation for a singular text
   * @param str input text
   * @return translated text or the original text if the translation is not found
   */
  gettext: (str: string): string => {
    if (translations) {
      const translated = translations[str];
      if (translated?.[0]) return translated[0];
    }

    // fallback, return the original text
    return str;
  },

  /**
   * get a translation for a plural text
   * @param str1 input singular text
   * @param strN input plural text
   * @param n the actual number which decides whether to use the
   *   singular or plural form (of which plural form if there are several of them)
   * @return translated text or the original text if the translation is not found
   */
  ngettext: (str1: string, strN: string, n: number) => {
    if (translations && plural_fn) {
      // plural form translations are indexed by the singular variant
      const translation = translations[str1];

      if (translation) {
        const plural_index = plural_fn(n);

        // the plural function either returns direct index (integer) in the plural
        // translations or a boolean indicating simple plural form which
        // needs to be converted to index 0 (singular) or 1 (plural)
        const index = plural_index === true ? 1 : plural_index || 0;

        if (translation[index]) return translation[index];
      }
    }

    // fallback, return the original text
    return n === 1 ? str1 : strN;
  },

  /**
   * Wrapper around Intl.ListFormat to get a language-specific representation of the given list of
   * strings. Returns the concatenation of the original strings with the correct language-specific
   * separators according to the currently selected language for the Agama UI
   *
   * @param list iterable list of strings to represent
   * @param options passed to the Intl.ListFormat constructor
   */
  formatList: (list: string[], options: object): string => {
    try {
      const formatter = new Intl.ListFormat(agama.language, options);
      return formatter.format(list);
    } catch (e) {
      // use a trivial formatting with commas when the locale formatting fails for whatever reason
      console.warn(
        `Using fallback list formatting function for language "${agama.language}", details:`,
        e,
      );
      return list.join(", ");
    }
  },
};

export default agama;
