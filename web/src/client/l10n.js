/*
 * Copyright (c) [2022-2023] SUSE LLC
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
import { timezoneUTCOffset } from "~/utils";

/**
 * @typedef {object} Timezone
 * @property {string} id - Timezone id (e.g., "Atlantic/Canary").
 * @property {Array<string>} parts - Name of the timezone parts (e.g., ["Atlantic", "Canary"]).
 * @property {string} country - Name of the country associated to the zone or empty string (e.g., "Spain").
 * @property {number} utcOffset - UTC offset.
 */

/**
 * @typedef {object} Locale
 * @property {string} id - Language id (e.g., "en_US.UTF-8").
 * @property {string} name - Language name (e.g., "English").
 * @property {string} territory - Territory name (e.g., "United States").
 */

/**
 * @typedef {object} Keymap
 * @property {string} id - Keyboard id (e.g., "us").
 * @property {string} name - Keyboard name (e.g., "English (US)").
 */

/**
 * Manages localization.
 */
class L10nClient {
  /**
   * @param {import("./http").HTTPClient} client - HTTP client.
   */
  constructor(client) {
    this.client = client;
  }

  /**
   * Selected locale to translate the installer UI.
   *
   * @return {Promise<String>} Locale id.
   */
  async getUILocale() {
    const config = await this.client.get("/l10n/config");
    return config.ui_locale;
  }

  /**
   * Sets the locale to translate the installer UI.
   *
   * @param {String} id - Locale id.
   * @return {Promise<void>}
   */
  async setUILocale(id) {
    return this.client.put("/l10n/config", { ui_locale: id });
  }

  /**
   * All possible timezones for the target system.
   *
   * @return {Promise<Array<Timezone>>}
   */
  async timezones() {
    const timezones = await this.client.get("/l10n/timezones");
    return timezones.map(this.buildTimezone);
  }

  /**
   * Timezone selected for the target system.
   *
   * @return {Promise<String>} Id of the timezone.
   */
  async getTimezone() {
    const config = await this.getConfig();
    return config.timezone;
  }

  /**
   * Sets the timezone for the target system.
   *
   * @param {string} id - Id of the timezone.
   * @return {Promise<void>}
   */
  async setTimezone(id) {
    this.setConfig({ timezone: id });
  }

  /**
   * Available locales to install in the target system.
   *
   * TODO: find a better name because it is rather confusing (e.g., 'locales'  and 'getLocales').
   *
   * @return {Promise<Array<Locale>>}
   */
  async locales() {
    const locales = await this.client.get("/l10n/locales");
    return locales.map(this.buildLocale);
  }

  /**
   * Locales selected to install in the target system.
   *
   * @return {Promise<Array<String>>} Ids of the locales.
   */
  async getLocales() {
    const config = await this.getConfig();
    return config.locales;
  }

  /**
   * Sets the locales to install in the target system.
   *
   * @param {Array<string>} ids - Ids of the locales.
   * @return {Promise<void>}
   */
  async setLocales(ids) {
    this.setConfig({ locales: ids });
  }

  /**
   * Available keymaps to install in the target system.
   *
   * Note that name is localized to the current selected UI language:
   * { id: "es", name: "Spanish (ES)" }
   *
   * @return {Promise<Array<Keymap>>}
   */
  async keymaps() {
    const keymaps = await this.client.get("/l10n/keymaps");
    return keymaps.map(this.buildKeymap);
  }

  /**
   * Keymap selected to install in the target system.
   *
   * @return {Promise<String>} Id of the keymap.
   */
  async getKeymap() {
    const config = await this.getConfig();
    return config.keymap;
  }

  /**
   * Sets the keymap to install in the target system.
   *
   * @param {string} id - Id of the keymap.
   * @return {Promise<void>}
   */
  async setKeymap(id) {
    this.setConfig({ keymap: id });
  }

  /**
   * Register a callback to run when the timezone configuration changes.
   *
   * @param {(timezone: string) => void} handler - Function to call when Timezone changes.
   * @return {import ("./http").RemoveFn} Function to disable the callback.
   */
  onTimezoneChange(handler) {
    return this.client.onEvent("L10nConfigChanged", ({ timezone }) => {
      if (timezone) {
        handler(timezone);
      }
    });
  }

  /**
   * Register a callback to run when the locales configuration changes.
   *
   * @param {(locales: string[]) => void} handler - Function to call when Locales changes.
   * @return {import ("./http").RemoveFn} Function to disable the callback.
   */
  onLocalesChange(handler) {
    return this.client.onEvent("L10nConfigChanged", ({ locales }) => {
      if (locales) {
        handler(locales);
      }
    });
  }

  /**
   * Register a callback to run when the keymap configuration changes.
   *
   * @param {(keymap: string) => void} handler - Function to call when Keymap changes.
   * @return {import ("./http").RemoveFn} Function to disable the callback.
   */
  onKeymapChange(handler) {
    return this.client.onEvent("L10nConfigChanged", ({ keymap }) => {
      if (keymap) {
        handler(keymap);
      }
    });
  }

  /**
   * @private
   * Convenience method to get l10n the configuration.
   *
   * @return {Promise<object>} Localization configuration.
   */
  async getConfig() {
    return await this.client.get("/l10n/config");
  }

  /**
   * @private
   *
   * Convenience method to set l10n the configuration.
   *
   * @param {object} data - Configuration to update. It can just part of the configuration.
   * @return {Promise<object>}
   */
  async setConfig(data) {
    return this.client.put("/l10n/config", data);
  }

  /**
   * @private
   *
   * @param {object} timezone - Timezone data.
   * @param {string} timezone.code - Timezone identifier.
   * @param {Array<string>} timezone.parts - Localized parts of the timezone identifier.
   * @param {string} timezone.country - Timezone country.
   * @return {Timezone}
   */
  buildTimezone({ code, parts, country }) {
    const utcOffset = timezoneUTCOffset(code);

    return ({ id: code, parts, country, utcOffset });
  }

  /**
   * @private
   *
   * @param {object} locale - Locale data.
   * @param {string} locale.code - Identifier.
   * @param {string} locale.name - Name.
   * @param {string} locale.territory - Territory.
   * @return {Locale}
   */
  buildLocale({ code, name, territory }) {
    return ({ id: code, name, territory });
  }

  /**
   * @private
   *
   * @param {object} keymap - Keymap data
   * @param {string} keymap.id - Id (e.g., "us").
   * @param {string} keymap.description - Keymap description (e.g., "English (US)").
   * @return {Keymap}
   */
  buildKeymap({ id, description }) {
    return ({ id, name: description });
  }
}

export { L10nClient };
