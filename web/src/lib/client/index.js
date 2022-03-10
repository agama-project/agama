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

import AuthClient from "./auth";
import LanguageClient from "./language";
import ManagerClient from "./manager";
import SoftwareClient from "./software";
import StorageClient from "./storage";

import cockpit from "../cockpit";

export default class InstallerClient {
  /**
   * @constructor
   */
  constructor() {
    this._proxies = {};
    this._client = cockpit.dbus("org.opensuse.DInstaller", {
      bus: "system",
      superuser: "try"
    });

    this.auth = new AuthClient(this._client)
    this.language = new LanguageClient(this._client);
    this.manager = new ManagerClient(this._client);
    this.software = new SoftwareClient(this._client);
    this.storage = new StorageClient(this._client);
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
}
