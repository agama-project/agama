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

const LOCALE_SERVICE = "org.opensuse.Agama1";
const LOCALE_IFACE = "org.opensuse.Agama1.Locale";
const LOCALE_PATH = "/org/opensuse/Agama1/Locale";

/**
 * @typedef {object} Timezone
 * @property {string} id - Timezone id (e.g., "Atlantic/Canary").
 * @property {Array<string>} parts - Name of the timezone parts (e.g., ["Atlantic", "Canary"]).
 */

/**
 * @typedef {object} Locale
 * @property {string} id - Language id (e.g., "en_US").
 * @property {string} name - Language name (e.g., "English").
 * @property {string} territory - Territory name (e.g., "United States").
 */

/**
 * @typedef {object} Keyboard
 * @property {string} id - Keyboard id (e.g., "us").
 * @property {string} name - Keyboard name (e.g., "English").
 * @property {string} territory - Territory name (e.g., "United States").
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
   * Available locales to translate the installer UI.
   *
   * Note that name and territory are localized to its own language:
   * { id: "es", name: "Español", territory: "España" }
   *
   * @return {Promise<Array<Locale>>}
   */
  async UILocales() {
    const proxy = await this.client.proxy(LOCALE_IFACE);
    const locales = await proxy.ListUILocales();

    // TODO: D-Bus currently returns the id only
    return locales.map(id => this.buildLocale([id, "", ""]));
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

    // TODO: D-Bus currently returns the timezone parts only
    return timezones.map(parts => this.buildTimezone(["", parts]));
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
   * Available keyboards to install in the target system.
   *
   * Note that name and territory are localized to the current selected UI language:
   * { id: "es", name: "Spanish", territory: "Spain" }
   *
   * @return {Promise<Array<Keyboard>>}
   */
  async keyboards() {
    const proxy = await this.client.proxy(LOCALE_IFACE);
    const keyboards = await proxy.ListVConsoleKeyboards();

    // TODO: D-Bus currently returns the id only
    return keyboards.map(id => this.buildKeyboard([id, "", ""]));
  }

  /**
   * Keyboard selected to install in the target system.
   *
   * @return {Promise<String>} Id of the keyboard.
   */
  async getKeyboard() {
    const proxy = await this.client.proxy(LOCALE_IFACE);
    return proxy.VConsoleKeyboard;
  }

  /**
   * Sets the keyboard to install in the target system.
   *
   * @param {string} id - Id of the keyboard.
   * @return {Promise<void>}
   */
  async setKeyboard(id) {
    const proxy = await this.client.proxy(LOCALE_IFACE);
    proxy.VConsoleKeyboard = id;
  }

  /**
   * Register a callback to run when properties in the Language object change
   *
   * @param {(language: string) => void} handler - function to call when the language change
   * @return {import ("./dbus").RemoveFn} function to disable the callback
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
   * @private
   *
   * @param {[string, Array<string>]} dbusTimezone
   * @returns {Timezone}
   */
  buildTimezone([id, parts]) {
    return ({ id, parts });
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
   * @param {[string, string, string]} dbusKeyboard
   * @returns {Keyboard}
   */
  buildKeyboard([id, name, territory]) {
    return ({ id, name, territory });
  }
}

export { L10nClient };
