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

import { NetworkManagerAdapter } from "./network_manager";
import { ConnectionTypes, ConnectionState } from "./model";
import { AgamaNetworkAdapter } from "./agama_network";

/**
 * @typedef {import("./model").NetworkSettings} NetworkSettings
 * @typedef {import("./model").Connection} Connection
 * @typedef {import("./model").ActiveConnection} ActiveConnection
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
 * @property {() => ActiveConnection[]} activeConnections
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
   * @param {NetworkAdapter} [adapter] - Network adapter. By default, it is set to
o  *   NetworkManagerAdapter.
   */
  constructor({ adapter, address }) {
    this.adapter = adapter || new AgamaNetworkAdapter(address);
    /** @type {!boolean} */
    this.subscribed = false;
    this.setUpDone = false;
    /** @type {NetworkEventFn[]} */
    this.handlers = [];
  }

  /**
   * Adds a callback to run when a network event happens (a connection is added,
   * updated, removed, etc.).
   *
   * @param {NetworkEventFn} handler - Callback function
   * @return {() => void} Function to remove the handler
   */
  onNetworkEvent(handler) {
    this.handlers.push(handler);
    return () => {
      const position = this.handlers.indexOf(handler);
      if (position > -1) this.handlers.splice(position, 1);
    };
  }

  /**
   * Set up the client
   */
  async setUp() {
    if (this.setUpDone) return;

    return this.adapter.setUp(e => this.handlers.forEach(f => f(e)));
  }

  /**
   * Returns the active connections
   *
   * @return {ActiveConnection[]}
   */
  activeConnections() {
    return this.adapter.activeConnections();
  }

  /**
   * Returns the connection settings
   *
   * @return {Promise<Connection[]>}
   */
  connections() {
    return this.adapter.connections();
  }

  /**
   * Returns the list of available wireless access points (AP)
   *
   * @return {AccessPoint[]}
   */
  accessPoints() {
    return this.adapter.accessPoints();
  }

  /**
   * Connects to given Wireless network
   *
   * @param {Connection} connection - connection to be activated
   */
  async connectTo(connection) {
    return this.adapter.connectTo(connection);
  }

  /**
   * Add the connection for the given Wireless network and activate it
   *
   * @param {string} ssid - Network id
   * @param {object} options - connection options
   */
  async addAndConnectTo(ssid, options) {
    return this.adapter.addAndConnectTo(ssid, options);
  }

  /**
   * Adds a new connection
   *
   * @param {Connection} connection - Connection to add
   */
  async addConnection(connection) {
    return this.adapter.addConnection(connection);
  }

  /**
   * Returns the connection with the given ID
   *
   * @param {string} id - Connection ID
   * @return {Promise<Connection>}
   */
  async getConnection(id) {
    return this.adapter.getConnection(id);
  }

  /**
   * Updates the connection
   *
   * It uses the 'path' to match the connection in the backend.
   *
   * @param {Connection} connection - Connection to update
   */
  async updateConnection(connection) {
    return this.adapter.updateConnection(connection);
  }

  /**
   * Deletes the connection
   *
   * It uses the 'path' to match the connection in the backend.
   *
   * @param {Connection} connection - Connection to delete
   */
  async deleteConnection(connection) {
    return this.adapter.deleteConnection(connection);
  }

  /*
   * Returns list of IP addresses for all active NM connections
   *
   * @todo remove duplicates
   * @private
   * @return {Promise<IPAddress[]>}
   */
  addresses() {
    const conns = this.adapter.activeConnections();
    return conns.flatMap(c => c.addresses);
  }

  /*
  * Returns network general settings
  */
  settings() {
    return this.adapter.settings();
  }
}

export {
  AgamaNetworkAdapter,
  ConnectionState,
  ConnectionTypes,
  NetworkClient,
  NetworkManagerAdapter,
  NetworkEventTypes
};
