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

import DBusClient from "../dbus";
import { NetworkManagerAdapter, securityFromFlags } from "./network_manager";
import cockpit from "../../lib/cockpit";
import { createConnection, ConnectionTypes, ConnectionState, createAccessPoint } from "./model";
import { formatIp, ipPrefixFor } from "./utils";

const SERVICE_NAME = "org.opensuse.Agama1";
const CONNECTIONS_IFACE = "org.opensuse.Agama1.Network.Connections";
const CONNECTIONS_PATH = "/org/opensuse/Agama1/Network/connections";
const CONNECTION_IFACE = "org.opensuse.Agama1.Network.Connection";
const CONNECTIONS_NAMESPACE = "/org/opensuse/Agama1/Network/connections";
const IP_IFACE = "org.opensuse.Agama1.Network.Connection.IP";
const WIRELESS_IFACE = "org.opensuse.Agama1.Network.Connection.Wireless";

const DeviceType = Object.freeze({
  LOOPBACK: 0,
  ETHERNET: 1,
  WIRELESS: 2,
  DUMMY: 3,
  BOND: 4
});

/**
 * @typedef {import("./model").NetworkSettings} NetworkSettings
 * @typedef {import("./model").Connection} Connection
 * @typedef {import("./model").IPAddress} IPAddress
 * @typedef {import("./model").AccessPoint} AccessPoint
 */

const NetworkEventTypes = Object.freeze({
  ACTIVE_CONNECTION_ADDED: "active_connection_added",
  ACTIVE_CONNECTION_UPDATED: "active_connection_updated",
  ACTIVE_CONNECTION_REMOVED: "active_connection_removed",
  CONNECTION_ADDED: "connection_added",
  CONNECTION_UPDATED: "connection_updated",
  CONNECTION_REMOVED: "connection_removed",
  SETTINGS_UPDATED: "settings_updated"
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
   * Returns the connection settings
   *
   * @return {Promise<Connection[]>}
   */
  async connections() {
    const connections = await this.client.get("/network/connections");

    return connections.map((connection) => {
      return this.fromApiConnection(connection);
    });
  }

  fromApiConnection(connection) {
    const nameservers = (connection.nameservers || []);
    const addresses = (connection.addresses || []).map((address) => {
      const [ip, netmask] = address.split("/");
      return { address: ip, prefix: ipPrefixFor(netmask) };
    });

    return { ...connection, addresses, nameservers };
  }

  toApiConnection(connection) {
    const addresses = (connection.addresses || []).map((addr) => formatIp(addr));
    const { iface, gateway4, gateway6, ...conn } = connection;

    if (gateway4?.trim() !== "") conn.gateway4 = gateway4;
    if (gateway6?.trim() !== "") conn.gateway6 = gateway6;

    return { ...conn, addresses, interface: iface };
  }

  /**
   * Returns the list of available wireless access points (AP)
   *
   * @return {Promise<AccessPoint[]>}
   */
  async accessPoints() {
    const access_points = await this.client.get("/network/wifi");

    return access_points.map(ap => {
      return createAccessPoint({
        ssid: ap.ssid,
        hwAddress: ap.hw_address,
        strength: ap.strength,
        security: securityFromFlags(ap.flags, ap.wpa_flags, ap.rsn_flags)
      });
    });
  }

  /**
   * Connects to given Wireless network
   *
   * @param {Connection} connection - connection to be activated
   */
  async connectTo(connection) {
    const conn = await this.addConnection(connection);
    await this.apply();

    return conn;
  }

  /**
   * Apply network changes
   */
  async apply() {
    return this.client.put("/network/system/apply");
  }

  /**
   * Add the connection for the given Wireless network and activate it
   *
   * @param {string} ssid - Network id
   * @param {object} options - connection options
   */
  async addAndConnectTo(ssid, options) {
    // duplicated code (see network manager adapter)
    const wireless = { ssid, mode: "infrastructure" };
    if (options.security) wireless.security = options.security;
    if (options.password) wireless.password = options.password;
    if (options.hidden) wireless.hidden = options.hidden;
    if (options.mode) wireless.mode = options.mode;

    const connection = createConnection({
      id: ssid,
      wireless,
    });

    // the connection is automatically activated when written
    return this.connectTo(connection);
  }

  /**
   * Adds a new connection
   *
   * If a connection with the given ID already exists, it updates such a
   * connection.
   *
   * @param {Connection} connection - Connection to add
   * @return {Promise<Connection>} the added connection
   */
  async addConnection(connection) {
    return this.client.post("/network/connections", this.toApiConnection(connection));
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
    return this.apply();
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
    return this.apply();
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
    return conns.flatMap(c => c.addresses);
  }

  /*
  * Returns network general settings
  *
   * @return {Promise<NetworkSettings>}
  */
  settings() {
    return this.client.get("/network/state");
  }
}

export {
  ConnectionState,
  ConnectionTypes,
  NetworkClient,
  NetworkEventTypes
};
