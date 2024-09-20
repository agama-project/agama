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

import { get, patch } from "~/api/http";
import { Keymap, Locale, LocaleConfig, Timezone } from "~/types/l10n";
import { timezoneUTCOffset } from "~/utils";

/**
 * Returns the l10n configuration
 */
const fetchConfig = (): Promise<LocaleConfig> => get("/api/l10n/config");

/**
 * Returns the list of known locales for installation
 */
const fetchLocales = async (): Promise<Locale[]> => {
  const json = await get("/api/l10n/locales");
  return json.map(({ id, language, territory }): Locale => {
    return { id, name: language, territory };
  });
};

/**
 * Returns the list of known timezones
 */
const fetchTimezones = async (): Promise<Timezone[]> => {
  const json = await get("/api/l10n/timezones");
  return json.map(({ code, parts, country }): Timezone => {
    const offset = timezoneUTCOffset(code);
    return { id: code, parts, country, utcOffset: offset };
  });
};

/**
 * Returns the list of known keymaps
 */
const fetchKeymaps = async (): Promise<Keymap[]> => {
  const json = await get("/api/l10n/keymaps");
  const keymaps: Keymap[] = json.map(({ id, description }): Keymap => {
    return { id, name: description };
  });
  return keymaps.sort((a, b) => (a.name < b.name ? -1 : 1));
};

/**
 * Updates the l10n configuration for the system to install
 *
 * @param config - Localization configuration
 */
const updateConfig = (config: LocaleConfig) => patch("/api/l10n/config", config);

export { fetchConfig, fetchKeymaps, fetchLocales, fetchTimezones, updateConfig };
