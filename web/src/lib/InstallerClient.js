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

const LANGUAGE_IFACE = "org.opensuse.DInstaller.Language1";
const SOFTWARE_IFACE = "org.opensuse.DInstaller.Software1";
const STORAGE_PROPOSAL_IFACE = "org.opensuse.DInstaller.Storage.Proposal1";
const STORAGE_ACTIONS_IFACE = "org.opensuse.DInstaller.Storage.Actions1";

export default class InstallerClient {
  /**
   * @constructor
   * @param {object} cockpit - Cockpit-like module
   */
  constructor(cockpit) {
    this._cockpit = cockpit ||= window.cockpit;
    this._proxies = {};
  }
  // Initializing the client in the constructor does not work for some reason.
  client() {
    if (!this._client) {
      this._client = this._cockpit.dbus("org.opensuse.DInstaller", {
        bus: "system",
        superuser: "try"
      });
    }
    return this._client;
  }

  async proxy(iface) {
    if (this._proxies[iface]) {
      return this._proxies[iface];
    }

    const proxy = this.client().proxy(iface, undefined, { watch: true });
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
  async getProducts() {
    const proxy = await this.proxy(SOFTWARE_IFACE);
    return proxy.AvailableBaseProducts.map(product => {
      const [{ v: id }, { v: name }] = product.v;
      return { id, name };
    });
  }

  async getSelectedProduct() {
    const proxy = await this.proxy(SOFTWARE_IFACE);
    return proxy.SelectedBaseProduct;
  }

  async selectProduct(id) {
    const proxy = await this.proxy(SOFTWARE_IFACE);
    return proxy.SelectProduct(id);
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

  /**
   * Return the actions for the current proposal
   *
   * @return {Promise.<Array.<Object>>}
   */
  async getStorageActions() {
    const proxy = await this.proxy(STORAGE_ACTIONS_IFACE);
    return proxy.All.map(action => {
      const { Text: textVar, Subvol: subvolVar } = action.v;
      return { text: textVar.v, subvol: subvolVar.v };
    });
  }

  /**
   * Return storage proposal settings
   *
   * @return {Promise.<Object>}
   */
  async getStorageProposal() {
    const proxy = await this.proxy(STORAGE_PROPOSAL_IFACE);
    return {
      availableDevices: proxy.AvailableDevices.map(d => d.v),
      candidateDevices: proxy.CandidateDevices.map(d => d.v),
      lvm: proxy.LVM
    };
  }

  async calculateStorageProposal({ candidateDevices }) {
    const proxy = await this.proxy(STORAGE_PROPOSAL_IFACE);
    return proxy.Calculate({
      CandidateDevices: this._cockpit.variant("as", candidateDevices)
    });
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
