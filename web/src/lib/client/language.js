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

import { applyMixin, withProxy } from "./mixins";

const LANGUAGE_IFACE = "org.opensuse.DInstaller.Language1";

export default class LanguageClient {
  constructor(dbusClient) {
    this._client = dbusClient;
  }

  /**
   * Return the list of available languages
   *
   * @return {Promise.<Array>}
   */
  async getLanguages() {
    const proxy = await this.proxy(LANGUAGE_IFACE);
    return proxy.AvailableLanguages.map(lang => {
      const [{ v: id }, { v: name }] = lang.v;
      return { id, name };
    });
  }

  /**
   * Return the languages selected for installation
   *
   * @return {Promise.<String|undefined>}
   */
  async getSelectedLanguages() {
    const proxy = await this.proxy(LANGUAGE_IFACE);
    return proxy.MarkedForInstall.map(lang => lang.v);
  }

  /**
   * Set the languages to install
   *
   * @param {string} langIDs - Identifier of languages to install
   * @return {Promise.<String|undefined>}
   */
  async setLanguages(langIDs) {
    const proxy = await this.proxy(LANGUAGE_IFACE);
    return proxy.ToInstall(langIDs);
  }
}

applyMixin(LanguageClient, withProxy);
