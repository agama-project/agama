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

// @ts-check

import React, { useCallback, useEffect, useState } from "react";
import { useCancellablePromise, locationReload, setLocationSearch } from "~/utils";
import cockpit from "../lib/cockpit";
import { useInstallerClient } from "./installer";

const L10nContext = React.createContext(null);

/**
 * @typedef {object} L10nContext
 * @property {string|undefined} language - current language
 * @property {(lang: string) => void} changeLanguage - function to change the current language
 *
 * @return {L10nContext} L10n context
 */
function useL10n() {
  const context = React.useContext(L10nContext);

  if (!context) {
    throw new Error("useL10n must be used within a L10nContext");
  }

  return context;
}

/**
 * Returns the current locale according to Cockpit
 *
 * It takes the locale from the CockpitLang cookie.
 *
 * @return {string|undefined} language tag in xx_XX format or undefined if
 *   it was not set.
 */
function cockpitLanguage() {
  // language from cookie, empty string if not set (regexp taken from Cockpit)
  // https://github.com/cockpit-project/cockpit/blob/98a2e093c42ea8cd2431cf15c7ca0e44bb4ce3f1/pkg/shell/shell-modals.jsx#L91
  const languageString = decodeURIComponent(document.cookie.replace(/(?:(?:^|.*;\s*)CockpitLang\s*=\s*([^;]*).*$)|^.*$/, "$1"));
  if (languageString) {
    return languageString.toLowerCase();
  }
}

/**
 * Helper function for storing the Cockpit language.
 *
 * This function automatically converts the language tag from xx_XX to xx-xx,
 * as it is the one used by Cockpit.
 *
 * @param {string} lang the new language tag (like "cs", "cs_CZ",...)
 * @return {boolean} returns true if the locale changed; false otherwise
 */
function storeUILanguage(lang) {
  const current = cockpitLanguage();
  if (current === lang) {
    return false;
  }
  // code taken from Cockpit
  const cookie = "CockpitLang=" + encodeURIComponent(lang) + "; path=/; expires=Sun, 16 Jul 3567 06:23:41 GMT";
  document.cookie = cookie;
  window.localStorage.setItem("cockpit.lang", lang);
  return true;
}

/**
 * Returns the language from the query string.
 *
 * @return {string|undefined} language tag in 'xx-xx' format (or just 'xx') or undefined if it was
 *   not set. It supports 'xx-xx', 'xx_xx', 'xx-XX' and 'xx_XX'.
 */
function languageFromQuery() {
  const lang = (new URLSearchParams(window.location.search)).get("lang");
  if (!lang) return undefined;

  const [language, country] = lang.toLowerCase().split(/[-_]/);
  return (country) ? `${language}-${country}` : language;
}

/**
 * Converts a language tag from the backend to a one compatible with RFC 5646 or
 * BCP 78
 *
 * @param {string} tag - language tag from the backend
 * @return {string} Language tag compatible with RFC 5646 or BCP 78
 *
 * @private
 * @see https://datatracker.ietf.org/doc/html/rfc5646
 * @see https://www.rfc-editor.org/info/bcp78
 */
function languageFromBackend(tag) {
  return tag.replace("_", "-").toLowerCase();
}

/**
 * Converts a language tag compatible with RFC 5646 to the format used by the backend
 *
 * @param {string} tag - language tag from the backend
 * @return {string} Language tag compatible with the backend
 *
 * @private
 * @see https://datatracker.ietf.org/doc/html/rfc5646
 * @see https://www.rfc-editor.org/info/bcp78
 */
function languageToBackend(tag) {
  const [language, country] = tag.split("-");
  return (country) ? `${language}_${country.toUpperCase()}` : language;
}

/**
 * Returns the list of languages from the navigator in RFC 5646 (or BCP 78)
 * format
 *
 * @return {Array<string>} List of languages from the navigator
 */
function navigatorLanguages() {
  return navigator.languages.map(l => l.toLowerCase());
}

/**
 * Returns the first supported language from the given list.
 *
 * @param {Array<string>} languages - Candidate languages
 * @return {string|undefined} First supported language or undefined if none
 *   of the given languages is supported.
 */
function findSupportedLanguage(languages) {
  const supported = Object.keys(cockpit.manifests.agama?.locales || {});

  for (const candidate of languages) {
    const [language, country] = candidate.split("-");

    const match = supported.find(s => {
      const [supportedLanguage, supportedCountry] = s.split("-");
      if (language === supportedLanguage) {
        return country === undefined || country === supportedCountry;
      } else {
        return false;
      }
    });
    if (match) return match;
  }
}

/**
 * Reloads the page
 *
 * It uses the window.location.replace instead of the reload function
 * synchronizing the "lang" argument from the URL if present.
 *
 * @param {string} newLanguage
 */
function reload(newLanguage) {
  const query = new URLSearchParams(window.location.search);
  if (query.has("lang") && query.get("lang") !== newLanguage) {
    query.set("lang", newLanguage);
    // Setting location search with a different value makes the browser to navigate
    // to the new URL.
    setLocationSearch(query.toString());
  } else {
    locationReload();
  }
}

/**
 * This provider sets the application language. By default, it uses the
 * URL "lang" query parameter or the preferred language from the browser and
 * synchronizes the UI and the backend languages. To activate a new language it
 * reloads the whole page.
 *
 * Additionally, it offers a function to change the current language.
 *
 * The format of the language tag follows the
 * [RFC 5646](https://datatracker.ietf.org/doc/html/rfc5646) specification.
 *
 * @param {object} props
 * @param {React.ReactNode} [props.children] - content to display within the wrapper
 * @param {import("~/client").InstallerClient} [props.client] - client
 *
 * @see useL10n
 */
function L10nProvider({ children }) {
  const client = useInstallerClient();
  const [language, setLanguage] = useState(undefined);
  const [backendPending, setBackendPending] = useState(false);
  const { cancellablePromise } = useCancellablePromise();

  const storeBackendLanguage = useCallback(async languageString => {
    if (!client) {
      setBackendPending(true);
      return false;
    }

    const currentLang = await cancellablePromise(client.language.getUILanguage());
    const normalizedLang = languageFromBackend(currentLang);

    if (normalizedLang !== languageString) {
      // FIXME: fallback to en-US if the language is not supported.
      await cancellablePromise(
        client.language.setUILanguage(languageToBackend(languageString))
      );
      return true;
    }
    return false;
  }, [client, cancellablePromise]);

  const changeLanguage = useCallback(async lang => {
    const wanted = lang || languageFromQuery();

    if (wanted === "xx" || wanted === "xx-xx") {
      cockpit.language = wanted;
      setLanguage(wanted);
      return;
    }

    const current = cockpitLanguage();
    const candidateLanguages = [wanted, current].concat(navigatorLanguages())
      .filter(l => l);
    const newLanguage = findSupportedLanguage(candidateLanguages) || "en-us";

    let mustReload = storeUILanguage(newLanguage);
    mustReload = await storeBackendLanguage(newLanguage) || mustReload;
    if (mustReload) {
      reload(newLanguage);
    } else {
      setLanguage(newLanguage);
    }
  }, [storeBackendLanguage, setLanguage]);

  useEffect(() => {
    if (!language) changeLanguage();
  }, [changeLanguage, language]);

  useEffect(() => {
    if (!client || !backendPending) return;

    storeBackendLanguage(language);
    setBackendPending(false);
  }, [client, language, backendPending, storeBackendLanguage]);

  return (
    <L10nContext.Provider value={{ language, changeLanguage }}>{children}</L10nContext.Provider>
  );
}

export {
  L10nProvider,
  useL10n
};
