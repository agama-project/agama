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

/**
 * Client to interact with the Agama manager service
 */
class ManagerClient {
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
   * @return {Promise<Response>}
   */
  startProbing() {
    return this.client.post("/manager/probe", {});
  }

  /**
   * Start the installation process
   *
   * The progress of the installation process can be tracked through installer signals.
   *
   * @return {Promise<Response>}
   */
  startInstallation() {
    return this.client.post("/manager/install", {});
  }

  /**
   * Returns the binary content of the YaST logs file
   *
   * @todo Implement a mechanism to get the logs.
   * @return {Promise<Response>}
   */
  async fetchLogs() {
    const response = await fetch(`${this.client.baseUrl}/manager/logs`);
    if (!response.ok) {
      throw new Error("Could not fetch the logs");
    }

    return response;
  }

  /**
   * Runs cleanup when installation is done
   */
  finishInstallation() {
    return this.client.post("/manager/finish", {});
  }
}

export { ManagerClient };
