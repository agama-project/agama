/*
 * Copyright (c) [2023] SUSE LLC
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

// cspell:ignore localectl setxkbmap xorg

import React, { useCallback, useEffect, useState } from "react";
import { locationReload, setLocationSearch } from "~/utils";
import { useInstallerClientStatus } from "./installer";
import agama from "~/agama";
import supportedLanguages from "~/languages.json";
import { fetchConfig, updateConfig } from "~/api/l10n";

const L10nContext = React.createContext(null);

/**
 * Installer localization context.
 */
interface L10nContext {
  language: string | undefined;
  keymap: string | undefined;
  changeLanguage: (language: string) => Promise<void>;
  changeKeymap: (keymap: string) => Promise<void>;
}

function useInstallerL10n(): L10nContext {
  const context = React.useContext(L10nContext);

  if (!context) {
    throw new Error("useInstallerL10n must be used within a InstallerL10nContext");
  }

  return context;
}

/**
 * Current language (in xx_XX format).
 *
 * It takes the language from the agamaLang cookie.
 *
 * @return Undefined if language is not set.
 */
function agamaLanguage(): string | undefined {
  // language from cookie, empty string if not set (regexp taken from Cockpit)
  // https://github.com/cockpit-project/cockpit/blob/98a2e093c42ea8cd2431cf15c7ca0e44bb4ce3f1/pkg/shell/shell-modals.jsx#L91
  return decodeURIComponent(
    document.cookie.replace(/(?:(?:^|.*;\s*)agamaLang\s*=\s*([^;]*).*$)|^.*$/, "$1"),
  );
}

/**
 * Helper function for storing the Agama language.
 *
 * Automatically converts the language from xx_XX to xx-xx, as it is the one used by Agama.
 *
 * @param language - The new locale (e.g., "cs", "cs_CZ").
 * @return True if the locale was changed.
 */
function storeAgamaLanguage(language: string): boolean {
  const current = agamaLanguage();
  if (current === language) return false;

  // Code taken from Cockpit.
  const cookie =
    "agamaLang=" + encodeURIComponent(language) + "; path=/; expires=Sun, 16 Jul 3567 06:23:41 GMT";
  document.cookie = cookie;

  return true;
}

/**
 * Returns the language tag from the query string.
 *
 * Query supports 'xx-xx', 'xx_xx', 'xx-XX' and 'xx_XX' formats.
 *
 * @return Undefined if not set.
 */
function languageFromQuery(): string | undefined {
  const lang = new URLSearchParams(window.location.search).get("lang");
  if (!lang) return undefined;

  const [language, country] = lang.split(/[-_]/);
  return country ? `${language.toLowerCase()}-${country.toUpperCase()}` : language;
}

/**
 * Generates a RFC 5646 (or BCP 78) language tag from a locale.
 *
 * @param locale
 * @return RFC 5646 language tag (e.g., "en-US")
 *
 * @private
 * @see https://datatracker.ietf.org/doc/html/rfc5646
 * @see https://www.rfc-editor.org/info/bcp78
 */
function languageFromLocale(locale: string): string {
  const [language] = locale.split(".");
  return language.replace("_", "-");
}

/**
 * Converts a RFC 5646 language tag to a locale.
 *
 * It forces the encoding to "UTF-8".
 *
 * @param language as a RFC 5646 language tag (e.g., "en-US")
 * @return locale (e.g., "en_US.UTF-8")
 *
 * @private
 * @see https://datatracker.ietf.org/doc/html/rfc5646
 * @see https://www.rfc-editor.org/info/bcp78
 */
function languageToLocale(language: string): string {
  const [lang, country] = language.split("-");
  const locale = country ? `${lang}_${country.toUpperCase()}` : lang;
  return `${locale}.UTF-8`;
}

/**
 * Returns the first supported language from the given list.
 *
 * @param languages - list of RFC 5646 language tags (e.g., ["en-US", "en"]) to check
 * @return Undefined if none of the given languages is supported.
 */
function findSupportedLanguage(languages: Array<string>): string | undefined {
  const supported = Object.keys(supportedLanguages);

  for (const candidate of languages) {
    const [language, country] = candidate.split("-");

    const match = supported.find((s) => {
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
 * Reloads the page.
 *
 * It uses the window.location.replace instead of the reload function synchronizing the "lang"
 * argument from the URL if present.
 *
 * @param newLanguage - new language to use.
 */
function reload(newLanguage: string) {
  const query = new URLSearchParams(window.location.search);
  if (query.has("lang") && query.get("lang") !== newLanguage) {
    query.set("lang", newLanguage);
    // Setting location search with a different value makes the browser to navigate to the new URL.
    setLocationSearch(query.toString());
  } else {
    locationReload();
  }
}

/**
 * This provider sets the installer locale. By default, it uses the URL "lang" query parameter or
 * the preferred locale from the browser and synchronizes the UI and the backend locales. To
 * activate a new locale it reloads the whole page.
 *
 * Additionally, it offers a function to change the current locale.
 *
 * The format of the language tag in the query parameter follows the
 * [RFC 5646](https://datatracker.ietf.org/doc/html/rfc5646) specification.
 *
 * @param props
 * @param [props.children] - Content to display within the wrapper.
 *
 * @see useInstallerL10n
 */
function InstallerL10nProvider({ children }: { children?: React.ReactNode }) {
  const { connected } = useInstallerClientStatus();
  const [language, setLanguage] = useState(undefined);
  const [keymap, setKeymap] = useState(undefined);

  const syncBackendLanguage = useCallback(async () => {
    const config = await fetchConfig();
    const backendLanguage = languageFromLocale(config.uiLocale);
    if (backendLanguage === language) return;

    // FIXME: fallback to en-US if the language is not supported.
    await updateConfig({ uiLocale: languageToLocale(language) });
  }, [language]);

  const changeLanguage = useCallback(
    async (lang?: string) => {
      const wanted = lang || languageFromQuery();

      // Just for development purposes
      if (wanted === "xx" || wanted === "xx-XX") {
        agama.language = wanted;
        setLanguage(wanted);
        return;
      }

      const candidateLanguages = [
        wanted,
        wanted?.split("-")[0], // fallback to the language (e.g., "es" for "es-AR")
        agamaLanguage(),
        ...navigator.languages,
      ].filter((l) => l);
      const newLanguage = findSupportedLanguage(candidateLanguages) || "en-US";
      const mustReload = storeAgamaLanguage(newLanguage);

      // load the translations dynamically, first try language + territory
      const po = newLanguage.replace("-", "_");
      await import(
        /* webpackChunkName: "[request]" */
        `../../src/po/po.${po}`
      ).catch(async () => {
        // if it fails then try the language only
        const po = newLanguage.split("-")[0];
        await import(
          /* webpackChunkName: "[request]" */
          `../../src/po/po.${po}`
        ).catch((error) => {
          if (newLanguage !== "en-US") {
            console.error("Cannot load frontend translations for", newLanguage, error);
          }
          // reset the current translations (use the original English texts)
          agama.locale(null);
        });
      });

      if (mustReload) {
        reload(newLanguage);
      } else {
        setLanguage(newLanguage);
      }
    },
    [setLanguage],
  );

  const changeKeymap = useCallback(
    async (id: string) => {
      if (!connected) return;

      setKeymap(id);
      await updateConfig({ uiKeymap: id });
    },
    [setKeymap, connected],
  );

  useEffect(() => {
    if (!language) changeLanguage();
  }, [changeLanguage, language]);

  useEffect(() => {
    if (!connected || !language) return;

    syncBackendLanguage();
  }, [connected, language, syncBackendLanguage]);

  useEffect(() => {
    if (!connected) return;

    fetchConfig().then((c) => setKeymap(c.uiKeymap));
  }, [setKeymap, connected]);

  const value = { language, changeLanguage, keymap, changeKeymap };

  return <L10nContext.Provider value={value}>{children}</L10nContext.Provider>;
}

export { InstallerL10nProvider, useInstallerL10n };
