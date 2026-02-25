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

import React, { useCallback } from "react";
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

/**
 * Load the web frontend translations from the server.
 *
 * @param locale requested locale
 * @returns Promise with a dynamic import
 */
async function loadTranslations(locale: string): Promise<string> {
  // load the translations dynamically, first try the language + territory
  return import(
    /* webpackChunkName: "[request]" */
    `../po/po.${locale}`
  )
    .then((m) => {
      agama.locale(m.default);
      return agama.language.replace("-", "_");
    })
    .catch(async () => {
      // if it fails try the language only
      const po = locale.split("-")[0];
      return import(
        /* webpackChunkName: "[request]" */
        `../po/po.${po}`
      )
        .then((m) => {
          agama.locale(m.default);
          return agama.language.replace("-", "_");
        })
        .catch(() => {
          if (locale && locale !== "en-US") {
            console.error("Cannot load frontend translations for", locale);
          }
          // reset the current translations (use the original English texts)
          agama.locale(null);
          return agama.language.replace("-", "_");
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

  const { data: loadedLanguage } = useSuspenseQuery({
    queryKey: ["translations", language],
    queryFn: () => loadTranslations(language),
  });

  const changeLanguage = useCallback(
    async (lang: string) => {
      const candidateLanguages = [
        lang,
        lang?.split("-")[0], // fallback to the language (e.g., "es" for "es-AR")
        language,
      ].filter((l) => l);
      const newLanguage = findSupportedLanguage(candidateLanguages) || "en-US";
      document.documentElement.lang = newLanguage.split("-")[0];

      await configureL10nAction({ locale: languageToLocale(newLanguage) });
      await queryClient.invalidateQueries({ queryKey: ["translations"] });
    },
    [language, queryClient],
  );

  const changeKeymap = useCallback(async (id: string) => {
    await configureL10nAction({ keymap: id });
  }, []);

  const value = {
    loadedLanguage,
    language,
    changeLanguage,
    keymap,
    changeKeymap,
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
