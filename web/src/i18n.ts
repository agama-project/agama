/*
 * Copyright (c) [2023-2024] SUSE LLC
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
 * This is a wrapper module for i18n functions. Currently it uses the
 * implementation similar to cockpit but the wrapper allows easy transition to
 * another backend if needed.
 */

import agama from "~/agama";
import type { Tagged } from "type-fest";

export type TranslatedString = Tagged<string, "Translated">;

/**
 * Tests whether a special testing language is used.
 */
const isTestingLanguage = (): boolean => agama.language === "xx";

/**
 * "Translate" the string to special "xx" testing language.
 * It just replaces all alpha characters with "x".
 * It keeps the percent placeholders like "%s" or "%d" unmodified.
 *
 * @param str input string
 * @returns "translated" string
 */
const xTranslate = (str: string): string => {
  let result = "";

  let wasPercent = false;
  for (let index = 0; index < str.length; index++) {
    const char = str[index];

    if (wasPercent) {
      result += char;
      wasPercent = false;
    } else {
      if (char === "%") {
        result += char;
        wasPercent = true;
      } else {
        result += char.replace(/[a-z]/, "x").replace(/[A-Z]/, "X");
      }
    }
  }

  return result;
};

/**
 * Returns a translated text in the current locale or the original text if the
 * translation is not found.
 *
 * @param str the input string to translate
 * @return translated or original text
 */
const _ = (str: string): TranslatedString =>
  (isTestingLanguage() ? xTranslate(str) : agama.gettext(str)) as TranslatedString;

/**
 * Similar to the _() function. This variant returns singular or plural form
 * depending on an additional "num" argument.
 *
 * @see {@link _} for further information
 * @param str1 the input string in the singular form
 * @param strN the input string in the plural form
 * @param n the actual number which decides whether to use the
 *   singular or plural form
 * @return translated or original text
 */
const n_ = (str1: string, strN: string, n: number): TranslatedString => {
  return (
    isTestingLanguage() ? xTranslate(n === 1 ? str1 : strN) : agama.ngettext(str1, strN, n)
  ) as TranslatedString;
};

/**
 * This is a no-op function, it can be used only for marking the text for
 * translation so it is extracted to the POT file but the text itself is not
 * translated. It needs to be translated by the _() function later.
 *
 * @example <caption>Error messages</caption>
 *   try {
 *     ...
 *     // the exception contains untranslated string
 *     throw(N_("Download failed"));
 *   } catch (error) {
 *     // log the untranslated error
 *     console.log(error);
 *     // for users display the translated error
 *     return <div>Error: {_(error)}</div>;
 *   }
 *
 * @example <caption>Constants</caption>
 *   // ERROR_MSG will not be translated, but the string will be found
 *   // by gettext when creating the POT file
 *   const RESULT = {
 *     ERROR: N_("Download failed"),
 *     OK: N_("Success")
 *   };
 *
 *   // assume that "result" contains one of the constants above
 *   const result = ...;
 *   // here the string will be translated using the current locale
 *   return <div>Result: {_(result)}</div>;
 *
 * @param str the input string
 * @return the input string
 */
const N_ = (str: string): string => str;

/**
 * Similar to the N_() function, but for the singular and plural form.
 *
 * @see {@link N_} for further information
 * @param str1 the input string in the singular form
 * @param strN the input string in the plural form
 * @param n the actual number which decides whether to use the
 *   singular or plural form
 * @return the original text, either "string1" or "stringN" depending
 *   on the value "num"
 */
const Nn_ = (str1: string, strN: string, n: number): string => (n === 1 ? str1 : strN);

/**
 * Wrapper around Intl.ListFormat to get a language-specific representation of the given list of
 * strings.
 *
 * @param {string[]} list iterable list of strings to represent
 * @param {object} options passed to the Intl.ListFormat constructor
 * @return {string} concatenation of the original strings with the correct language-specific
 *  separators according to the currently selected language for the Agama UI
 */
const formatList = (list, options = {}) => agama.formatList(list, options);

export { _, n_, N_, Nn_, formatList };
