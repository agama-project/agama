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

/**
 * @typedef {import("./model").Connection} Connection
 * @typedef {import("./model").ActiveConnection} ActiveConnection
 * @typedef {import("./model").IPAddress} IPAddress
 * @typedef {import("./model").AccessPoint} AccessPoint
 */

const NetworkEventTypes = Object.freeze({
  ACTIVE_CONNECTION_ADDED: "active_connection_added",
  ACTIVE_CONNECTION_UPDATED: "active_connection_updated",
  ACTIVE_CONNECTION_REMOVED: "active_connection_removed"
});

/** @typedef {(conns: ActiveConnection[]) => void} ConnectionFn */
/** @typedef {(conns: string[]) => void} ConnectionPathsFn */

/**
 * @typedef {object} Handlers
 * @property {ConnectionFn[]} connectionAdded
 * @property {ConnectionFn[]} connectionRemoved
 * @property {ConnectionFn[]} connectionUpdated
 */

/**
 * @typedef {object} NetworkAdapter
 * @property {() => ActiveConnection[]} activeConnections
 * @property {() => AccessPoint[]} accessPoints
 * @property {(handler: (event: NetworkEvent) => void) => void} subscribe
 * @property {(id: string) => Promise<Connection>} getConnection
 * @property {(connection: Connection) => Promise<any>} addConnection
 * @property {(connection: Connection) => Promise<any>} updateConnection
 * @property {() => string} hostname
 * @property {() => void} setUp
 */

/**
 * Returns given IP address in the X.X.X.X/YY format
 *
 * @param {IPAddress} addr
 * @return {string}
 */
const formatIp = addr => `${addr.address}/${addr.prefix}`;

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
  constructor(adapter) {
    this.adapter = adapter || new NetworkManagerAdapter();
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
   * @returns {ActiveConnection[]}
   */
  activeConnections() {
    return this.adapter.activeConnections();
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

  /**
   * Returns the computer's hostname
   *
   * @return {string}
   */
  hostname() {
    return this.adapter.hostname();
  }
}

export {
  ConnectionState, ConnectionTypes, formatIp, NetworkClient, NetworkManagerAdapter, NetworkEventTypes
};
