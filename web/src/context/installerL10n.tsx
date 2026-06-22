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

import React, { useCallback, useEffect } from "react";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import agama from "~/agama";
import supportedLanguages from "~/languages.json";
import { useSystem } from "~/hooks/model/system";
import { configureL10nAction } from "~/api";

const L10nContext = React.createContext(null);

/**
 * Installer localization context.
 */
interface L10nContext {
  // Current language in RFC 5646 format (e.g., "en-US").
  language: string;
  // Current keymap (e.g., "en")
  keymap: string;
  // Loaded language matching <lang> in the po.<lang>.js file (e.g., "en", "pt_BR").
  loadedLanguage: string;
  changeLanguage: (language: string) => Promise<void>;
  changeKeymap: (keymap: string) => Promise<void>;
  changeL10n: (options: { language?: string; keymap?: string }) => Promise<void>;
}

function useInstallerL10n(): L10nContext {
  const context = React.useContext(L10nContext);

  if (!context) {
    throw new Error("useInstallerL10n must be used within a InstallerL10nContext");
  }

  return context;
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

// Translation catalog as exported by the po.<lang>.js files. A null catalog
// means there are no translations and the original English texts must be used.
type TranslationCatalog = object | null;

/**
 * Loads the web frontend translation catalog for the given locale.
 *
 * The catalog is returned as plain data so the caller decides when to apply it
 * to the global translation singleton. A `null` result means the original
 * (English) texts must be used.
 *
 * @param locale requested locale
 * @returns Promise resolving to the translation catalog, or null when there are
 *   no translations for the locale
 */
async function loadTranslations(locale: string): Promise<TranslationCatalog> {
  // load the translations dynamically, first try the language + territory
  return import(
    /* webpackChunkName: "[request]" */
    `../po/po.${locale}`
  )
    .then((m) => m.default)
    .catch(async () => {
      // if it fails try the language only
      const po = locale.split("-")[0];
      return import(
        /* webpackChunkName: "[request]" */
        `../po/po.${po}`
      )
        .then((m) => m.default)
        .catch(() => {
          if (locale && locale !== "en-US") {
            console.error("Cannot load frontend translations for", locale);
          }
          // no translations available, fall back to the original English texts
          return null;
        });
    });
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
function InstallerL10nProvider({
  initialLanguage,
  children,
}: {
  initialLanguage?: string;
  children?: React.ReactNode;
}) {
  const queryClient = useQueryClient();
  const system = useSystem();
  const l10n = system?.l10n;

  const locale = l10n?.locale;
  const language = locale ? languageFromLocale(locale) : initialLanguage || "en-US";
  const keymap = l10n?.keymap;

  // Load the translation catalog for the current language. Suspends until the
  // catalog is ready, so the children below never render before it is available.
  const { data: catalog } = useSuspenseQuery({
    queryKey: ["translations", language],
    queryFn: () => loadTranslations(language),
  });

  // Apply the catalog to the global translation singleton on every render,
  // before the children read it. Doing it here (instead of as a side effect
  // inside the query function) keeps the active translations in sync with the
  // rendered language even when the query is served from cache, which makes
  // switching languages reliable without reloading the page.
  agama.locale(catalog);
  const loadedLanguage = agama.language.replace("-", "_");

  // Keep the <html lang> attribute in sync for assistive technologies, both on
  // the initial load and after a language change.
  useEffect(() => {
    document.documentElement.lang = language.split("-")[0];
  }, [language]);

  // Resolves a requested language to the closest supported one, falling back to
  // the current language and finally to English.
  const resolveSupportedLanguage = useCallback(
    (requested: string): string => {
      const candidates = [requested, requested.split("-")[0], language].filter(Boolean);
      return findSupportedLanguage(candidates) || "en-US";
    },
    [language],
  );

  // Updates the language and/or the keymap in a single backend request.
  // Refreshing the system query updates the locale, which makes the provider
  // re-render with the new language and apply the matching translations.
  const changeL10n = useCallback(
    async ({ language: lang, keymap: km }: { language?: string; keymap?: string }) => {
      const config: { locale?: string; keymap?: string } = {};

      if (lang !== undefined) config.locale = languageToLocale(resolveSupportedLanguage(lang));
      if (km !== undefined) config.keymap = km;

      await configureL10nAction(config);
      await queryClient.invalidateQueries({ queryKey: ["system"] });
    },
    [resolveSupportedLanguage, queryClient],
  );

  const changeLanguage = useCallback(
    (lang: string) => changeL10n({ language: lang }),
    [changeL10n],
  );

  const changeKeymap = useCallback((id: string) => changeL10n({ keymap: id }), [changeL10n]);

  const value = {
    loadedLanguage,
    language,
    changeLanguage,
    keymap,
    changeKeymap,
    changeL10n,
  };

  // Setting the key forces to reload the children when the language changes
  // (see https://react.dev/learn/preserving-and-resetting-state).
  return (
    <L10nContext.Provider key={language} value={value}>
      {children}
    </L10nContext.Provider>
  );
}

export { InstallerL10nProvider, useInstallerL10n };
