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

import LanguageClient from "./language";
import ManagerClient from "./manager";
import SoftwareClient from "./software";
import StorageClient from "./storage";

export default class InstallerClient {
  /**
   * @constructor
   * @param {object} cockpit - Cockpit-like module
   */
  constructor(cockpit) {
    this._cockpit = cockpit ||= window.cockpit;
    this._proxies = {};
    this._client = this._cockpit.dbus("org.opensuse.DInstaller", {
      bus: "system",
      superuser: "try"
    });

    this.language = new LanguageClient(this._client);
    this.manager = new ManagerClient(this._client);
    this.software = new SoftwareClient(this._client);
    this.storage = new StorageClient(this._client);
  }

  async proxy(iface) {
    if (this._proxies[iface]) {
      return this._proxies[iface];
    }

    const proxy = this._client.proxy(iface, undefined, { watch: true });
    await proxy.wait();
    this._proxies[iface] = proxy;
    return proxy;
  }

  /**
   * Register a callback to run when some D-Bus property changes
   *
   * @param {function} handler - callback function
   */
  onPropertyChanged(handler) {
    const { remove } = this._client.subscribe(
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
    const { remove } = this._client.subscribe(
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
}
