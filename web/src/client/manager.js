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

import { WithProgress, WithStatus } from "./mixins";

const MANAGER_PATH = "/org/opensuse/Agama/Manager1";
const MANAGER_SERVICE = "org.opensuse.Agama.Manager1";

/**
 * Manager base client
 *
 * @ignore
 */
class ManagerBaseClient {
  /**
   * @param {import("./http").HTTPClient} client - HTTP client.
   */
  constructor(client) {
    this.client = client;
  }

  /**
   * Run probing process
   *
   * The progress of the probing process can be tracked through installer signals.
   *
   * @return {Promise<void>}
   */
  startProbing() {
    return this.client.post("/manager/probe");
  }

  /**
   * Start the installation process
   *
   * The progress of the installation process can be tracked through installer signals.
   *
   * @return {Promise}
   */
  startInstallation() {
    return this.client.post("/manager/install");
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
    const installer = await this.client.get("/manager/installer");
    return installer.can_install;
  }

  /**
   * Returns the binary content of the YaST logs file
   *
   * @todo Implement a mechanism to get the logs.
   * @return {Promise<void>}
   */
  async fetchLogs() {
    // TODO
  }

  /**
   * Return the installer status
   *
   * @return {Promise<number>}
   */
  async getPhase() {
    const installer = await this.client.get("/manager/installer");
    return installer.phase;
  }

  /**
   * Register a callback to run when the "CurrentInstallationPhase" changes
   *
   * @param {function} handler - callback function
   * @return {import ("./dbus").RemoveFn} function to disable the callback
   */
  onPhaseChange(handler) {
    return this.client.onEvent("InstallationPhaseChanged", ({ phase }) => {
      if (phase) {
        handler(phase);
      }
    });
  }

  /**
   * Runs cleanup when installation is done
   */
  finishInstallation() {
    return this.client.post("/manager/install");
  }

  /**
   * Returns whether Iguana is used on the system
   *
   * @return {Promise<boolean>}
   */
  async useIguana() {
    const installer = await this.client.get("/manager/installer");
    return installer.iguana;
  }
}

/**
 * Client to interact with the Agama manager service
 */
class ManagerClient extends WithProgress(
  WithStatus(ManagerBaseClient, "/manager/status", MANAGER_SERVICE),
  MANAGER_PATH,
) {}

export { ManagerClient };
