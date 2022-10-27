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

const NetworkEventTypes = Object.freeze({
  ACTIVE_CONNECTION_ADDED: "active_connection_added",
  ACTIVE_CONNECTION_UPDATED: "active_connection_updated",
  ACTIVE_CONNECTION_REMOVED: "active_connection_removed"
});

/**
 * Enum for the active connection state values
 *
 * @readonly
 * @enum { number }
 * https://networkmanager.dev/docs/api/latest/nm-dbus-types.html#NMActiveConnectionState
 */
const ConnectionState = Object.freeze({
  UNKWOWN: 0,
  ACTIVATING: 1,
  ACTIVATED: 2,
  DEACTIVATING: 3,
  DEACTIVATED: 4
});

const ConnectionTypes = Object.freeze({
  ETHERNET: "802-3-ethernet",
  WIFI: "802-11-wireless"
});

/**
 * @typedef {object} IPAddress
 * @property {string} address - like "129.168.1.2"
 * @property {string} prefix - like "16"
 */

/**
 * @typedef {object} ActiveConnection
 * @property {string} id
 * @property {string} name
 * @property {string} type
 * @property {number} state
 * @property {IPAddress[]} addresses
 */

/**
 * @typedef {object} Connection
 * @property {string} id
 * @property {string} name
 * @property {IPv4} ipv4
 */

/**
 * @typedef {object} IPv4
 * @property {string} method
 * @property {IPAddress[]} addresses
 * @property {string[]} nameServers
 * @property {IPAddress} gateway
 */

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
 * @property {() => Promise<ActiveConnection[]>} activeConnections
 * @property {(handler: (event: NetworkEvent) => void) => void} subscribe
 * @property {(id: string) => Promise<Connection>} getConnection
 * @property {(connection: Connection) => Promise<any>} updateConnection
 * @property {() => Promise<string>} hostname
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
    /** @type {Handlers} */
    this.handlers = {
      connectionAdded: [],
      connectionRemoved: [],
      connectionUpdated: []
    };
  }

  /**
   * Returns IP config overview - addresses, connections and hostname
   * @return {Promise<{addresses: IPAddress[], hostname: string, connections: ActiveConnection[]}>}
   */
  async config() {
    return {
      connections: await this.adapter.activeConnections(),
      addresses: await this.addresses(),
      hostname: await this.adapter.hostname()
    };
  }

  /**
   * Registers a callback to run when a given event happens
   *
   * @param {"connectionAdded" | "connectionUpdated" | "connectionRemoved"} eventType - event type
   * @param {ConnectionFn} handler - the callback to be executed
   * @return {function} a function to remove the callback
   */
  listen(eventType, handler) {
    if (!this.subscribed) {
      // FIXME: when/where should we unsubscribe?
      this.subscribe();
    }

    this.handlers[eventType].push(handler);
    return () => {
      this.handlers[eventType].filter(h => h !== handler);
    };
  }

  /**
   * FIXME: improve this documentation
   * Starts listening changes on active connections
   *
   * @private
   * @return {Promise<any>} function to disable the callback
   */
  async subscribe() {
    // TODO: refactor this method
    this.subscribed = true;

    this.adapter.subscribe(({ type, payload }) => {
      switch (type) {
        case NetworkEventTypes.ACTIVE_CONNECTION_ADDED: {
          this.handlers.connectionAdded.forEach(handler => handler(payload));
          break;
        }

        case NetworkEventTypes.ACTIVE_CONNECTION_UPDATED: {
          this.handlers.connectionUpdated.forEach(handler => handler(payload));
          break;
        }

        case NetworkEventTypes.ACTIVE_CONNECTION_REMOVED: {
          this.handlers.connectionRemoved.forEach(handler => handler(payload.path));
          break;
        }
      }
    });
  }

  /**
   * Returns the active connections
   *
   * @returns {Promise<ActiveConnection[]>}
   */
  async activeConnections() {
    return this.adapter.activeConnections();
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
  async addresses() {
    const conns = await this.adapter.activeConnections();
    return conns.flatMap(c => c.addresses);
  }
}

export {
  ConnectionState, ConnectionTypes, formatIp, NetworkClient, NetworkManagerAdapter, NetworkEventTypes
};
