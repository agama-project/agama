/*
 * Copyright (c) [2023] SUSE LLC
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
//
// @import { AccessPoint, Device } from "~/types/network.ts";

import { ConnectionState } from "~/types/network";


const NetworkEventTypes = Object.freeze({
  DEVICE_ADDED: "deviceAdded",
  DEVICE_REMOVED: "deviceRemoved",
  DEVICE_UPDATED: "deviceUpdated",
  CONNECTION_ADDED: "connectionAdded",
  CONNECTION_UPDATED: "connectionUpdated",
  CONNECTION_REMOVED: "connectionRemoved",
  SETTINGS_UPDATED: "settingsUpdated",
});

/**
 * Network event
 *
 * @typedef {object} NetworkEvent
 * @property {string} type
 * @property {object} payload
 */

/**
 * Network event handler
 *
 * @typedef {(event: NetworkEvent) => void} NetworkEventFn
 */

/**
 * Network client
 */
class NetworkClient {
  /**
   * @param {import("../http").HTTPClient} client - HTTP client.
   */
  constructor(client) {
    this.client = client;
  }

  /**
   * Registers a callback to run when the network config change.
   *
   * @param {(handler: NetworkEvent) => void} handler - Callback function.
   * @return {import ("../http").RemoveFn} Function to remove the callback.
   */
  onNetworkChange(handler) {
    return this.client.onEvent("NetworkChange", ({ type, ...data }) => {
      console.log("Event:", type, ", with data:", data);
      const subtype = Object.values(NetworkEventTypes).find((event) => data[event]);

      if (subtype === undefined) {
        console.error("Unknown subevent:", data);
      } else {
        const payload = data[subtype];
        if (payload) {
          handler({ type: subtype, payload });
        }
      }
    });
  }
}

export { ConnectionState, NetworkClient, NetworkEventTypes };
