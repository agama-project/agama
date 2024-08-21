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
   * @return {Promise<String>} Locale ID.
   */
  async getUILocale() {
    const response = await this.client.get("/l10n/config");
    if (!response.ok) {
      console.error("Failed to get localization config: ", response);
      return "";
    }
    const config = await response.json();
    return config.uiLocale;
  }

  /**
   * Sets the locale to translate the installer UI.
   *
   * @param {String} id - Locale ID.
   * @return {Promise<Response>}
   */
  async setUILocale(id) {
    return this.client.patch("/l10n/config", { uiLocale: id });
  }

  /**
   * Selected keymap for the installer.
   *
   * This setting is only relevant in the local installation.
   *
   * @return {Promise<String>} Keymap ID.
   */
  async getUIKeymap() {
    const response = await this.client.get("/l10n/config");
    if (!response.ok) {
      console.error("Failed to get localization config: ", response);
      return "";
    }
    const config = await response.json();
    return config.uiKeymap;
  }

  /**
   * Sets the keymap to use in the installer.
   *
   * This setting is only relevant in the local installation.
   *
   * @param {String} id - Keymap ID.
   * @return {Promise<Response>}
   */
  async setUIKeymap(id) {
    return this.client.patch("/l10n/config", { uiKeymap: id });
  }
}

export { L10nClient };
