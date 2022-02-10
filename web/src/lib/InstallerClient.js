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

  onSignal(signal, handler) {
    const { remove } = this.client().subscribe(
      { interface: "org.opensuse.YaST.Installer", member: signal },
      handler
    );
    return remove;
  }

  authorize(username, password) {
    const auth = window.btoa(`${username}:${password}`);

    return new Promise((resolve, reject) => {
      return fetch("/cockpit/login", {
        headers: { Authorization: `Basic ${auth}`, "X-Superuser": "any" }
      }).then(resp => {
        if (resp.status == 200) {
          resolve();
        } else {
          reject(resp.statusText);
        }
      });
    });
  }

  isLoggedIn() {
    return new Promise((resolve, reject) => {
      return fetch("/cockpit/login").then(resp => {
        resolve(resp.status === 200);
      });
    });
  }

  currentUser() {
    return this._cockpit.user();
  }

  async getStatus() {
    return await this._callInstallerMethod("GetStatus");
  }

  async getProducts() {
    return await this._callInstallerMethod("GetProducts");
  }

  async getLanguages() {
    const languages = await this._callInstallerMethod("GetLanguages");
    return Object.keys(languages).map(key => {
      return { id: key, name: languages[key][1] };
    });
  }

  async getStorage() {
    return await this._callInstallerMethod("GetStorage");
  }

  async getDisks() {
    return await this._callInstallerMethod("GetDisks");
  }

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

  }

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

  async setOption(name, value) {
    return await this.client().call(
      "/org/opensuse/YaST/Installer",
      "org.freedesktop.DBus.Properties",
      "Set",
      ["org.opensuse.YaST.Installer", name, this._cockpit.variant("s", value)]
    );
  }
}
