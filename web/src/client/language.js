/*
 * Copyright (c) [2022] SUSE LLC
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

const LANGUAGE_SERVICE = "org.opensuse.Agama.Locale1";
const LANGUAGE_IFACE = "org.opensuse.Agama.Locale1";
const LANGUAGE_PATH = "/org/opensuse/Agama/Locale1";

/**
 * @typedef {object} Language
 * @property {string} id - Language ID (e.g., "en_US")
 * @property {string} name - Language name (e.g., "English (US)")
 */

/**
 * Allows getting the list of available languages and selecting one for installation.
 */
class LanguageClient {
  /**
   * @param {string|undefined} address - D-Bus address; if it is undefined, it uses the system bus.
   */
  constructor(address = undefined) {
    this.client = new DBusClient(LANGUAGE_SERVICE, address);
  }

  /**
   * Returns the list of available languages
   *
   * @return {Promise<Array<Language>>}
   */
  async getLanguages() {
    const proxy = await this.client.proxy(LANGUAGE_IFACE);
    const locales = proxy.SupportedLocales;
    const labels = proxy.LabelsForLocales;
    return locales.map((locale, index) => {
      // labels structure is [[en_lang, en_territory], [native_lang, native_territory]]
      const [[en_lang,], [,]] = labels[index];
      return { locale, en_lang };
    });
  }

  /**
   * Returns the languages selected for installation
   *
   * @return {Promise<Array<String>>} IDs of the selected languages
   */
  async getSelectedLanguages() {
    const proxy = await this.client.proxy(LANGUAGE_IFACE);
    return proxy.Locale;
  }

  /**
   * Set the languages to install
   *
   * @param {string} langIDs - Identifier of languages to install
   * @return {Promise<void>}
   */
  async setLanguages(langIDs) {
    const proxy = await this.client.proxy(LANGUAGE_IFACE);
    proxy.Locale = langIDs;
  }

  /**
   * Register a callback to run when properties in the Language object change
   *
   * @param {(language: string) => void} handler - function to call when the language change
   * @return {import ("./dbus").RemoveFn} function to disable the callback
   */
  onLanguageChange(handler) {
    return this.client.onObjectChanged(LANGUAGE_PATH, LANGUAGE_IFACE, changes => {
      const selected = changes.Locale.v[0];
      handler(selected);
    });
  }
}

export { LanguageClient };
