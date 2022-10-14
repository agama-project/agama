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

import { DBusClient } from "./dbus";

import cockpit from "../lib/cockpit";

const NM_SERVICE_NAME = "org.freedesktop.NetworkManager";
const NM_IFACE = "org.freedesktop.NetworkManager";
const NM_SETTINGS_IFACE = "org.freedesktop.NetworkManager.Settings";
const NM_CONNECTION_IFACE = "org.freedesktop.NetworkManager.Settings.Connection";
const NM_ACTIVE_CONNECTION_IFACE = "org.freedesktop.NetworkManager.Connection.Active";
const NM_IP4CONFIG_IFACE = "org.freedesktop.NetworkManager.IP4Config";

/**
 * Enum for the active connection state values
 *
 * @readonly
 * @enum { number }
 * https://networkmanager.dev/docs/api/latest/nm-dbus-types.html#NMActiveConnectionState
 */
const CONNECTION_STATE = {
  UNKWOWN: 0,
  ACTIVATING: 1,
  ACTIVATED: 2,
  DEACTIVATING: 3,
  DEACTIVATED: 4
};

// TODO: document
const CONNECTION_TYPES = {
  ETHERNET: "802-3-ethernet",
  WIFI: "802-11-wireless"
};

/**
 * @typedef {object} IPAddress
 * @property {string} address - like "129.168.1.2"
 * @property {string} prefix - like "16"
 */

/**
 * @typedef {object} Connection
 * @property {string} id
 * @property {string} path
 * @property {string} type
 * @property {number} state
 * @property {IPAddress[]} addresses
 */

/** @typedef {(conns: Connection[]) => void} ConnectionFn */
/** @typedef {(conns: string[]) => void} ConnectionPathsFn */

/**
 * @typedef {object} Handlers
 * @property {ConnectionFn[]} connectionAdded
 * @property {ConnectionFn[]} connectionRemoved
 * @property {ConnectionFn[]} connectionUpdated
 */

/**
 * @typedef {object} NetworkAdapter
 * @property {function} activeConnections
 * @property {() => Promise<string>} hostname
 */

/**
 * Returns given IP address in the X.X.X.X/YY format
 *
 * @property {IPAddress} addr
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
 * NetworkClient adapter for NetworkManager
 */
class NetworkManagerAdapter {
  /**
   * @param {DBusClient} [dbusClient] - D-Bus client
   */
  constructor(dbusClient) {
    this.client = dbusClient || new DBusClient(NM_SERVICE_NAME);
    /** @type {string[]}) */
    this.connectionPaths = [];
  }

  /**
   * Returns the active connections
   *
   * @returns { Promise.<Connection[]> }
   */
  async activeConnections() {
    let connections = [];
    const paths = await this.activeConnectionsPaths();

    for (const path of paths) {
      connections = [...connections, await this.connection(path)];
    }

    return connections;
  }

  /**
   * Subscribes to network events
   *
   * @param {(event: NetworkEvent) => void} handler - Event handler function
   */
  async subscribe(handler) {
    this.connectionsPaths = await this.activeConnectionsPaths();

    this.client.onSignal(
      { interface: "org.freedesktop.NetworkManager.Connection.Active", member: "StateChanged" },
      path => {
        this.connection(path).then(c => handler({ type: "CONNECTION_UPDATED", payload: c }));
      }
    );

    return this.client.onObjectChanged(
      "/org/freedesktop/NetworkManager",
      "org.freedesktop.NetworkManager",
      changes => {
        if ("ActiveConnections" in changes && Array.isArray(changes.ActiveConnections.v)) {
          const oldActiveConnections = this.connectionsPaths;
          this.connectionsPaths = changes.ActiveConnections.v.map(v => v.toString());
          const addedConnections = this.connectionsPaths.filter(
            c => !oldActiveConnections.includes(c)
          );
          const removedConnections = oldActiveConnections.filter(
            c => !this.connectionsPaths.includes(c)
          );
          if (addedConnections.length) {
            this.findConnections(addedConnections).then(connections =>
              connections.forEach(c => handler({ type: "CONNECTION_ADDED", payload: c }))
            );
          }

          if (removedConnections.length) {
            removedConnections.forEach(path => handler({ type: "CONNECTION_REMOVED", payload: path }));
          }
        }
      }
    );
  }

  /**
   * Updates the connection
   *
   * It uses the 'path' to match the connection in the backend.
   *
   * @param {Connection} connection - Connection to update
   */
  async updateConnection(connection) {
    const proxy = await this.client.proxy(NM_ACTIVE_CONNECTION_IFACE, connection.path);
    const settingsPath = proxy.Connection;
    const settingsObject = await this.client.proxy(NM_CONNECTION_IFACE, settingsPath);
    const settings = await settingsObject.GetSettings();

    /* la parte complicada */

    console.log("#updateConnection connection", connection);
    console.log("#updateConnection settings", settings);
    delete settings.ipv4.addresses;
    const newSettings = {
      ...settings,
      connection: {
        ...settings.connection,
        id: cockpit.variant("s", connection.id)
      },
      ipv4: {
        ...settings.ipv4,
        "address-data": cockpit.variant("aa{sv}", connection.addresses.map(addr => (
          {
            address: cockpit.variant("s", addr.address),
            prefix: cockpit.variant("u", parseInt(addr.prefix))
          }
        ))
        ),
        method: cockpit.variant("s", "manual")
      }
    };

    console.log("#updateConnection newsettings", newSettings);

    return settingsObject.Update(newSettings);
  }

  /*
   * Returns the list of active NM connections paths
   *
   * @returns { Promise.<string[]> }
   *
   * Private method.
   * See NM API documentation for details.
   * https://developer-old.gnome.org/NetworkManager/stable/gdbus-org.freedesktop.NetworkManager.html
   */
  async activeConnectionsPaths() {
    const proxy = await this.client.proxy(NM_IFACE);
    return proxy.ActiveConnections;
  }

  /**
   * @param {string[]} paths - Device paths
   */
  findConnections(paths) {
    return Promise.all(paths.map(path => this.connection(path)));
  }

  /**
   *
   * @param {string} path
   * @returns {Promise.<Connection>}
   */
  async connection(path) {
    const connection = await this.client.proxy(NM_ACTIVE_CONNECTION_IFACE, path);
    let addresses = [];

    if (connection.State === CONNECTION_STATE.ACTIVATED) {
      const ip4Config = await this.client.proxy(NM_IP4CONFIG_IFACE, connection.Ip4Config);
      addresses = ip4Config.AddressData.map(this.connectionIPAddress);
    }

    return {
      id: connection.Id,
      path,
      addresses,
      type: connection.Type,
      state: connection.State
    };
  }

  /*
   * Returns NM IP config for the particular connection
   *
   * @private
   * See NM API documentation for details
   * https://developer-old.gnome.org/NetworkManager/stable/gdbus-org.freedesktop.NetworkManager.Connection.Active.html
   * https://developer-old.gnome.org/NetworkManager/stable/gdbus-org.freedesktop.NetworkManager.IP4Config.html
   *
   * FIXME: improve data types
   * @param {object} data
   * @return {Promise<IPAddress>}
   */
  connectionIPAddress(data) {
    return { address: data.address.v, prefix: data.prefix.v };
  }

  /**
   * Returns the computer's hostname
   *
   * @returns { Promise.<string> }
   *
   * https://developer-old.gnome.org/NetworkManager/stable/gdbus-org.freedesktop.NetworkManager.Settings.html
   */
  async hostname() {
    const proxy = await this.client.proxy(NM_SETTINGS_IFACE);
    return proxy.Hostname;
  }
}

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
   * @return {Promise<{ addresses: IPAddress[], hostname: string, connections: Connection[]}>}
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
   * @param {"connectionAdded" | "connectionRemoved" | "connectionUpdated"} eventType - event type
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
    this.susbcribed = true;

    this.adapter.subscribe(event => {
      const { type, payload } = event;
      switch (type) {
        case "CONNECTION_ADDED": {
          this.handlers.connectionAdded.forEach(handler => handler(payload));
          break;
        }

        case "CONNECTION_UPDATED": {
          this.handlers.connectionUpdated.forEach(handler => handler(payload));
          break;
        }

        case "CONNECTION_REMOVED": {
          this.handlers.connectionRemoved.forEach(handler => handler(payload));
          break;
        }
      }
    });
  }

  /**
   * Returns the active connections
   *
   * @returns { Promise.<Connection[]> }
   */
  async activeConnections() {
    return this.adapter.activeConnections();
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
   * @return {Promise.<IPAddress[]>}
   */
  async addresses() {
    const conns = await this.adapter.activeConnections();
    return conns.flatMap(c => c.addresses);
  }
}

export { CONNECTION_STATE, CONNECTION_TYPES, formatIp, NetworkClient, NetworkManagerAdapter };
