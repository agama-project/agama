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
import { WithStatus, WithProgress } from "./mixins";
import cockpit from "../lib/cockpit";

const MANAGER_SERVICE = "org.opensuse.Agama.Manager1";
const MANAGER_IFACE = "org.opensuse.Agama.Manager1";
const MANAGER_PATH = "/org/opensuse/Agama/Manager1";

/**
 * Manager base client
 *
 * @ignore
 */
class ManagerBaseClient {
  /**
   * @param {string|undefined} address - D-Bus address; if it is undefined, it uses the system bus.
   */
  constructor(address = undefined) {
    this.client = new DBusClient(MANAGER_SERVICE, address);
  }

  /**
   * Run probing process
   *
   * The progress of the probing process can be tracked through installer signals.
   *
   * @return {Promise<void>}
   */
  async startProbing() {
    const proxy = await this.client.proxy(MANAGER_IFACE);
    return proxy.Probe();
  }

  /**
   * Start the installation process
   *
   * The progress of the installation process can be tracked through installer signals.
   *
   * @return {Promise}
   */
  async startInstallation() {
    const proxy = await this.client.proxy(MANAGER_IFACE);
    return proxy.Commit();
  }

  /**
   * Checks whether it is possible to start the installation
   *
   * It might happen that there are some validation errors. In that case,
   * it is not possible to proceed with the installation.
   *
   * @return {Promise<boolean>}
   */
  async canInstall() {
    const proxy = await this.client.proxy(MANAGER_IFACE);
    return proxy.CanInstall();
  }

  /**
   * Returns the binary content of the YaST logs file
   *
   * @return {Promise<Uint8Array>}
   */
  async fetchLogs() {
    const proxy = await this.client.proxy(MANAGER_IFACE);
    const path = await proxy.CollectLogs;
    const file = cockpit.file(path, { binary: true });
    return file.read();
  }

  /**
   * Return the installer status
   *
   * @return {Promise<number>}
   */
  async getPhase() {
    const proxy = await this.client.proxy(MANAGER_IFACE);
    return proxy.CurrentInstallationPhase;
  }

  /**
   * Register a callback to run when the "CurrentInstallationPhase" changes
   *
   * @param {function} handler - callback function
   * @return {import ("./dbus").RemoveFn} function to disable the callback
   */
  onPhaseChange(handler) {
    return this.client.onObjectChanged(MANAGER_PATH, MANAGER_IFACE, (changes) => {
      if ("CurrentInstallationPhase" in changes) {
        handler(changes.CurrentInstallationPhase.v);
      }
    });
  }

  /**
   * Runs cleanup when installation is done
   */
  async finishInstallation() {
    const proxy = await this.client.proxy(MANAGER_IFACE);
    return proxy.Finish();
  }

  /**
   * Returns whether Iguana is used on the system
   */
  async useIguana() {
    const proxy = await this.client.proxy(MANAGER_IFACE);
    return proxy.IguanaBackend;
  }
}

/**
  * Client to interact with the Agama manager service
  */
class ManagerClient extends WithProgress(WithStatus(ManagerBaseClient, MANAGER_PATH), MANAGER_PATH) { }

export { ManagerClient };
