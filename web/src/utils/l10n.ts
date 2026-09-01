/*
 * Copyright (c) [2026] SUSE LLC
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
 * Generates a RFC 5646 (or BCP 78) language tag from a locale.
 *
 * @param locale (e.g., "en_US.UTF-8")
 * @return RFC 5646 language tag (e.g., "en-US")
 *
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
 * @see https://datatracker.ietf.org/doc/html/rfc5646
 * @see https://www.rfc-editor.org/info/bcp78
 */
function languageToLocale(language: string): string {
  const [lang, country] = language.split("-");
  const locale = country ? `${lang}_${country.toUpperCase()}` : lang;
  return `${locale}.UTF-8`;
}

export { languageFromLocale, languageToLocale };
