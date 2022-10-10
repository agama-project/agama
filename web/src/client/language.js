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
import { DBusClient } from "./dbus";

const LANGUAGE_SERVICE = "org.opensuse.DInstaller.Language";
const LANGUAGE_IFACE = "org.opensuse.DInstaller.Language1";
const LANGUAGE_PATH = "/org/opensuse/DInstaller/Language1";

/**
 * @typedef {object} Language
 * @property {string} Language ID (e.g., "en_US")
 * @property {string} Language name (e.g., "English (US)")
 */

/**
 * Allows getting the list of available languages and selecting one for installation.
 */
class LanguageClient {
  /**
   * @param {DBusClient} [dbusClient] - D-Bus client
   */
  constructor(dbusClient) {
    this.client = dbusClient || new DBusClient(LANGUAGE_SERVICE);
  }

  /**
   * Returns the list of available languages
   *
   * @return {Promise<Array<Language>>}
   */
  async getLanguages() {
    const proxy = await this.client.proxy(LANGUAGE_IFACE);
    return proxy.AvailableLanguages.map(lang => {
      const [id, name] = lang;
      return { id, name };
    });
  }

  /**
   * Returns the languages selected for installation
   *
   * @return {Promise<Array<String>>} IDs of the selected languages
   */
  async getSelectedLanguages() {
    const proxy = await this.client.proxy(LANGUAGE_IFACE);
    return proxy.MarkedForInstall;
  }

  /**
   * Set the languages to install
   *
   * @param {string} langIDs - Identifier of languages to install
   * @return {Promise<void>}
   */
  async setLanguages(langIDs) {
    const proxy = await this.client.proxy(LANGUAGE_IFACE);
    return proxy.ToInstall(langIDs);
  }

  /**
   * Register a callback to run when properties in the Language object change
   *
   * @param {(language: string) => void} handler - function to call when the language change
   * @return {import ("./dbus").RemoveFn} function to disable the callback
   */
  onLanguageChange(handler) {
    return this.client.onObjectChanged(LANGUAGE_PATH, LANGUAGE_IFACE, changes => {
      const selected = changes.MarkedForInstall.v[0];
      handler(selected);
    });
  }
}

export { LanguageClient };
