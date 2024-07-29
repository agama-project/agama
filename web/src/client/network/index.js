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

import { Connection, ConnectionState } from "~/types/network";
import { formatIp } from "~/utils/network";


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
 * @typedef {object} NetworkAdapter
 * @property {() => AccessPoint[]} accessPoints
 * @property {() => Promise<Connection[]>} connections
 * @property {(handler: (event: NetworkEvent) => void) => void} subscribe
 * @property {(id: string) => Promise<Connection>} getConnection
 * @property {(ssid: string, options: object) => boolean} addAndConnectTo
 * @property {(connection: Connection) => boolean} connectTo
 * @property {(connection: Connection) => Promise<any>} addConnection
 * @property {(connection: Connection) => Promise<any>} updateConnection
 * @property {(connection: Connection) => void} deleteConnection
 * @property {() => NetworkSettings} settings
 * @property {() => void} setUp
 */

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
   * Connects to given Wireless network
   *
   * @param {Connection} connection - connection to be activated
   */
  async connectTo(connection) {
    return this.client.get(`/network/connections/${connection.id}/connect`);
  }

  /**
   * Connects to given Wireless network
   *
   * @param {Connection} connection - connection to be activated
   */
  async disconnect(connection) {
    return this.client.get(`/network/connections/${connection.id}/disconnect`);
  }

  /**
   * Apply network changes
   */
  async apply() {
    return this.client.put("/network/system/apply", {});
  }

  toApiConnection(connection) {
    const addresses = (connection.addresses || []).map((addr) => formatIp(addr));
    const { iface, gateway4, gateway6, ...conn } = connection;

    if (gateway4?.trim() !== "") conn.gateway4 = gateway4;
    if (gateway6?.trim() !== "") conn.gateway6 = gateway6;

    return { ...conn, addresses, interface: iface };
  }

  /**
   * Returns the connection with the given ID
   *
   * @param {string} id - Connection ID
   * @return {Promise<Connection|undefined>}
   */
  async getConnection(id) {
    const connections = await this.connections();

    return connections.find((conn) => conn.id === id);
  }

  /**
   * Updates the connection
   *
   * It uses the 'id' to match the connection in the backend.
   *
   * @param {Connection} connection - Connection to update
   * @return {Promise<boolean>} - the promise resolves to true if the connection
   *   was successfully updated and to false it it does not exist.
   */
  async updateConnection(connection) {
    const conn = this.toApiConnection(connection);
    await this.client.put(`/network/connections/${conn.id}`, conn);
    return (await this.apply()).ok;
  }

  /**
   * Deletes the connection
   *
   * It uses the 'path' to match the connection in the backend.
   *
   * @param {String} id - Connection id
   * @return {Promise<boolean>} - the promise resolves to true if the connection
   *  was successfully deleted.
   */
  async deleteConnection(id) {
    await this.client.delete(`/network/connections/${id}`);
    return (await this.apply()).ok;
  }

  /*
   * Returns list of IP addresses for all active NM connections
   *
   * @todo remove duplicates
   * @private
   * @return {Promise<IPAddress[]>}
   */
  async addresses() {
    const conns = await this.connections();
    return conns.flatMap((c) => c.addresses);
  }

  /*
   * Returns network general settings
   *
   * @return {Promise<NetworkSettings>}
   */
  async settings() {
    const response = await this.client.get("/network/state");
    if (!response.ok) {
      return {};
    }
    return response.json();
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
