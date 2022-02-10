/*
 * Copyright (c) [2021] SUSE LLC
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

import cockpit from "./cockpit";

export default class InstallerClient {
  /**
   * @constructor
   * @param {object} cockpit - Cockpit-like module
   */
  constructor(cockpit) {
    this._cockpit = cockpit ||= window.cockpit;
  }
  // Initializing the client in the constructor does not work for some reason.
  client() {
    if (!this._client) {
      this._client = this._cockpit.dbus("org.opensuse.YaST", {
        bus: "system",
        superuser: "try"
      });
    }
    return this._client;
  }

  /**
   * Register a callback to run when some D-Bus property changes
   *
   * @param {function} handler - callback function
   */
  onPropertyChanged(handler) {
    const { remove } = this.client().subscribe(
      {
        interface: "org.freedesktop.DBus.Properties",
        member: "PropertiesChanged"
      },
      handler
    );
    return remove;
  }

  /**
   * Register a callback to run when some D-Bus signal is emitted
   *
   * @param {function} handler - callback function
   */
  onSignal(signal, handler) {
    const { remove } = this.client().subscribe(
      { interface: "org.opensuse.YaST.Installer", member: signal },
      handler
    );
    return remove;
  }

  /**
   * Authorize using username and password
   *
   * @param {string} username - username
   * @param {string} password - password
   * @returns {Promise} resolves if the authencation was successful; rejects
   *   otherwise with an error message
   */
  authorize(username, password) {
    const auth = window.btoa(`${username}:${password}`);

    return new Promise((resolve, reject) => {
      return fetch("/cockpit/login", {
        headers: { Authorization: `Basic ${auth}`, "X-Superuser": "any" }
      }).then(resp => {
        if (resp.status == 200) {
          resolve(true);
        } else {
          reject(resp.statusText);
        }
      });
    });
  }

  /**
   * Determine whether a user is logged in
   *
   * @return {Promise.<boolean>} true if the user is logged in; false otherwise
   */
  isLoggedIn() {
    return new Promise((resolve, reject) => {
      return fetch("/cockpit/login")
        .then(resp => {
          resolve(resp.status === 200);
        })
        .catch(reject);
    });
  }

  /**
   * Return the current username
   *
   * @return {Promise.<string>}
   */
  currentUser() {
    return this._cockpit.user();
  }

  /**
   * Return the installer status
   *
   * @return {Promise.<number>}
   */
  getStatus() {
    return this._callInstallerMethod("GetStatus");
  }

  /**
   * Return the list of available products
   *
   * @return {Promise.<Array>}
   */
  getProducts() {
    return this._callInstallerMethod("GetProducts");
  }

  /**
   * Return the list of available languages
   *
   * @return {Promise.<Array>}
   */
  async getLanguages() {
    const languages = await this._callInstallerMethod("GetLanguages");
    return Object.keys(languages).map(key => {
      return { id: key, name: languages[key][1] };
    });
  }

  /**
   * Return the current storage proposal
   *
   * @return {Promise.<Array>}
   */
  getStorage() {
    return this._callInstallerMethod("GetStorage");
  }

  /**
   * Return the list of available disks
   *
   * @return {Promise.<Array>}
   */
  async getDisks() {
    return this._callInstallerMethod("GetDisks");
  }

  /**
   * Get the value for a given option
   *
   * At this point, only string-based values are supported.
   *
   * @param {string} name - Option name
   * @return {Promise.<String>}
   */
  async getOption(name) {
    try {
      const [{ v: option }] = await this.client().call(
        "/org/opensuse/YaST/Installer",
        "org.freedesktop.DBus.Properties",
        "Get",
        ["org.opensuse.YaST.Installer", name]
      );
      return option;
    } catch (e) {
      console.error(`Error getting option "${name}":`, e);
    }
  }

  /**
   * Set the value for a given option
   *
   * At this point, only string-based values are supported.
   *
   * @param {string} name - Option name
   * @param {string} value - Option value
   * @return {Promise.<String>}
   */
  async setOption(name, value) {
    return await this.client().call(
      "/org/opensuse/YaST/Installer",
      "org.freedesktop.DBus.Properties",
      "Set",
      ["org.opensuse.YaST.Installer", name, this._cockpit.variant("s", value)]
    );
  }

  /**
   * Start the installation process
   *
   * The progress of the installation process can be tracked through installer
   * signals (see {onSignal}).
   *
   * @return {Promise}
   */
  async startInstallation() {
    return await this._callInstallerMethod("Start");
  }

  async _callInstallerMethod(meth) {
    const result = await this.client().call(
      "/org/opensuse/YaST/Installer",
      "org.opensuse.YaST.Installer",
      meth
    );
    return result[0];
  }
}
