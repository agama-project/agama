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

import { useCallback, useEffect, useState } from "react";
import { useCancellablePromise } from "~/utils";
import cockpit from "./lib/cockpit";

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
function wantedLanguage() {
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
 * This is a helper component to set the language. It uses the
 * URL "lang" query parameter or the preferred language from the browser and
 * synchronizes the UI and the backend languages
 * To activate a new language it reloads the whole page.
 *
 * It behaves like a wrapper, it just wraps the children components, it does
 * not render any real content.
 *
 * The format of the language tag follows the
 * [RFC 5646](https://datatracker.ietf.org/doc/html/rfc5646) specification.
 *
 * @param {object} props
 * @param {React.ReactNode} [props.children] - content to display within the wrapper
 * @param {import("~/client").InstallerClient} [props.client] - client
 */
export default function L10nWrapper({ client, children }) {
  const [language, setLanguage] = useState(undefined);
  const { cancellablePromise } = useCancellablePromise();

  const storeBackendLanguage = useCallback(async languageString => {
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

  const selectLanguage = useCallback(async () => {
    const wanted = wantedLanguage();

    if (wanted === "xx" || wanted === "xx-xx") {
      cockpit.language = wanted;
      setLanguage(wanted);
      return;
    }

    const current = cockpitLanguage();
    const newLanguage = wanted || current || navigator.language.toLowerCase();

    let mustReload = storeUILanguage(newLanguage);
    mustReload = await storeBackendLanguage(newLanguage) || mustReload;
    if (mustReload) {
      window.location.reload();
    } else {
      setLanguage(newLanguage);
    }
  }, [storeBackendLanguage, setLanguage]);

  useEffect(() => {
    if (!language) selectLanguage();
  }, [selectLanguage, language]);

  if (!language) {
    return null;
  }

  return children;
}
