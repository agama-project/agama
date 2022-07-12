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

import { applyMixin, withDBus, withStatus, withProgress } from "./mixins";
import cockpit from "../lib/cockpit";

const MANAGER_IFACE = "org.opensuse.DInstaller.Manager1";
const MANAGER_PATH = "/org/opensuse/DInstaller/Manager1";

/**
 * Manager client
 */
class ManagerClient {
  constructor(dbusClient) {
    this._client = dbusClient;
  }

  /**
   * Run probing process
   *
   * The progress of the probing process can be tracked through installer
   * signals (see {onSignal}).
   *
   * @return {Promise}
   */
  async startProbing() {
    const proxy = await this.proxy(MANAGER_IFACE);
    return proxy.Probe();
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
    const proxy = await this.proxy(MANAGER_IFACE);
    return proxy.Commit();
  }

  /**
   * Return the installer status
   *
   * @return {Promise.<number>}
   */
  async getPhase() {
    const proxy = await this.proxy(MANAGER_IFACE);
    return proxy.CurrentInstallationPhase;
  }

  /**
   * Register a callback to run when the "CurrentInstallationPhase" changes
   *
   * @param {function} handler - callback function
   * @return {function} function to disable callback
   */
  onPhaseChange(handler) {
    return this.onObjectChanged(MANAGER_PATH, MANAGER_IFACE, (changes) => {
      if ("CurrentInstallationPhase" in changes) {
        handler(changes.CurrentInstallationPhase.v);
      }
    });
  }

  /**
   * Returns whether calling the system reboot suceeded or not.
   *
   * @return {Promise.<boolean>}
   */
  rebootSystem() {
    return cockpit.spawn(["/usr/sbin/shutdown", "-r", "now"]);
  }
}

applyMixin(
  ManagerClient, withDBus, withStatus(MANAGER_PATH), withProgress(MANAGER_PATH)
);
export default ManagerClient;
