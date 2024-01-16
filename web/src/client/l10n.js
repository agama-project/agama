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
import DBusClient from "./dbus";
import { timezoneUTCOffset } from "~/utils";

const LOCALE_SERVICE = "org.opensuse.Agama1";
const LOCALE_IFACE = "org.opensuse.Agama1.Locale";
const LOCALE_PATH = "/org/opensuse/Agama1/Locale";

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
   * @param {string|undefined} address - D-Bus address; if it is undefined, it uses the system bus.
   */
  constructor(address = undefined) {
    this.client = new DBusClient(LOCALE_SERVICE, address);
  }

  /**
   * Selected locale to translate the installer UI.
   *
   * @return {Promise<String>} Locale id.
   */
  async getUILocale() {
    const proxy = await this.client.proxy(LOCALE_IFACE);
    return proxy.UILocale;
  }

  /**
   * Sets the locale to translate the installer UI.
   *
   * @param {String} id - Locale id.
   * @return {Promise<void>}
   */
  async setUILocale(id) {
    const proxy = await this.client.proxy(LOCALE_IFACE);
    proxy.UILocale = id;
  }

  /**
   * All possible timezones for the target system.
   *
   * @return {Promise<Array<Timezone>>}
   */
  async timezones() {
    const proxy = await this.client.proxy(LOCALE_IFACE);
    const timezones = await proxy.ListTimezones();

    return timezones.map(this.buildTimezone);
  }

  /**
   * Timezone selected for the target system.
   *
   * @return {Promise<String>} Id of the timezone.
   */
  async getTimezone() {
    const proxy = await this.client.proxy(LOCALE_IFACE);
    return proxy.Timezone;
  }

  /**
   * Sets the timezone for the target system.
   *
   * @param {string} id - Id of the timezone.
   * @return {Promise<void>}
   */
  async setTimezone(id) {
    const proxy = await this.client.proxy(LOCALE_IFACE);
    proxy.Timezone = id;
  }

  /**
   * Available locales to install in the target system.
   *
   * @return {Promise<Array<Locale>>}
   */
  async locales() {
    const proxy = await this.client.proxy(LOCALE_IFACE);
    const locales = await proxy.ListLocales();

    return locales.map(this.buildLocale);
  }

  /**
   * Locales selected to install in the target system.
   *
   * @return {Promise<Array<String>>} Ids of the locales.
   */
  async getLocales() {
    const proxy = await this.client.proxy(LOCALE_IFACE);
    return proxy.Locales;
  }

  /**
   * Sets the locales to install in the target system.
   *
   * @param {Array<string>} ids - Ids of the locales.
   * @return {Promise<void>}
   */
  async setLocales(ids) {
    const proxy = await this.client.proxy(LOCALE_IFACE);
    proxy.Locales = ids;
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
    const proxy = await this.client.proxy(LOCALE_IFACE);
    const keymaps = await proxy.ListKeymaps();

    return keymaps.map(this.buildKeymap);
  }

  /**
   * Keymap selected to install in the target system.
   *
   * @return {Promise<String>} Id of the keymap.
   */
  async getKeymap() {
    const proxy = await this.client.proxy(LOCALE_IFACE);
    return proxy.Keymap;
  }

  /**
   * Sets the keymap to install in the target system.
   *
   * @param {string} id - Id of the keymap.
   * @return {Promise<void>}
   */
  async setKeymap(id) {
    const proxy = await this.client.proxy(LOCALE_IFACE);

    proxy.Keymap = id;
  }

  /**
   * Register a callback to run when Timezone D-Bus property changes.
   *
   * @param {(timezone: string) => void} handler - Function to call when Timezone changes.
   * @return {import ("./dbus").RemoveFn} Function to disable the callback.
   */
  onTimezoneChange(handler) {
    return this.client.onObjectChanged(LOCALE_PATH, LOCALE_IFACE, changes => {
      if ("Timezone" in changes) {
        const id = changes.Timezone.v;
        handler(id);
      }
    });
  }

  /**
   * Register a callback to run when Locales D-Bus property changes.
   *
   * @param {(language: string) => void} handler - Function to call when Locales changes.
   * @return {import ("./dbus").RemoveFn} Function to disable the callback.
   */
  onLocalesChange(handler) {
    return this.client.onObjectChanged(LOCALE_PATH, LOCALE_IFACE, changes => {
      if ("Locales" in changes) {
        const selectedIds = changes.Locales.v;
        handler(selectedIds);
      }
    });
  }

  /**
   * Register a callback to run when Keymap D-Bus property changes.
   *
   * @param {(language: string) => void} handler - Function to call when Keymap changes.
   * @return {import ("./dbus").RemoveFn} Function to disable the callback.
   */
  onKeymapChange(handler) {
    return this.client.onObjectChanged(LOCALE_PATH, LOCALE_IFACE, changes => {
      if ("Keymap" in changes) {
        const id = changes.Keymap.v;
        handler(id);
      }
    });
  }

  /**
   * @private
   *
   * @param {[string, Array<string>, string]} dbusTimezone
   * @returns {Timezone}
   */
  buildTimezone([id, parts, country]) {
    const utcOffset = timezoneUTCOffset(id);

    return ({ id, parts, country, utcOffset });
  }

  /**
   * @private
   *
   * @param {[string, string, string]} dbusLocale
   * @returns {Locale}
   */
  buildLocale([id, name, territory]) {
    return ({ id, name, territory });
  }

  /**
   * @private
   *
   * @param {[string, string]} dbusKeymap
   * @returns {Keymap}
   */
  buildKeymap([id, name]) {
    return ({ id, name });
  }
}

export { L10nClient };
