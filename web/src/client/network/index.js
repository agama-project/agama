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
import { NetworkManagerAdapter } from "./network_manager";
import cockpit from "../../lib/cockpit";
import { createConnection, ConnectionTypes, ConnectionState } from "./model";

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
   * @param {string} address - D-Bus address
   */
  constructor(address) {
    this.subscribed = false;
    this.nm = new NetworkManagerAdapter();
    this.client = new DBusClient(SERVICE_NAME, address);
    this.proxies = {
      connectionsRoot: null,
      connections: {},
      ipConfigs: {},
      wireless: {}
    };
    this.eventsHandler = null;
    this.setUpDone = false;
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

    this.proxies = {
      connectionsRoot: await this.client.proxy(CONNECTIONS_IFACE, CONNECTIONS_PATH),
      connections: await this.client.proxies(CONNECTION_IFACE, CONNECTIONS_NAMESPACE),
      ipConfigs: await this.client.proxies(IP_IFACE, CONNECTIONS_NAMESPACE),
      wireless: await this.client.proxies(WIRELESS_IFACE, CONNECTIONS_NAMESPACE)
    };

    this.setUpDone = true;
    return this.nm.setUp(e => this.handlers.forEach(f => f(e)));
  }

  /**
   * Returns the active connections
   *
   * @return {ActiveConnection[]}
   */
  activeConnections() {
    return this.nm.activeConnections();
  }

  /**
   * Returns the connection settings
   *
   * @return {Promise<Connection[]>}
   */
  connections() {
    return this.nm.connections();
  }

  /**
   * Returns the list of available wireless access points (AP)
   *
   * @return {AccessPoint[]}
   */
  accessPoints() {
    return this.nm.accessPoints();
  }

  /**
   * Connects to given Wireless network
   *
   * @param {Connection} connection - connection to be activated
   */
  async connectTo(connection) {
    return this.nm.connectTo(connection);
  }

  /**
   * Add the connection for the given Wireless network and activate it
   *
   * @param {string} ssid - Network id
   * @param {object} options - connection options
   */
  async addAndConnectTo(ssid, options) {
    // duplicated code (see network manager adapter)
    const wireless = { ssid };
    if (options.security) wireless.security = options.security;
    if (options.password) wireless.password = options.password;
    if (options.hidden) wireless.hidden = options.hidden;

    const connection = createConnection({
      name: ssid,
      wireless
    });

    const added = await this.addConnection(connection);
    return this.connectTo(added);
  }

  /**
   * Adds a new connection
   *
   * @param {Connection} connection - Connection to add
   * @return {Promise<Connection>} the added connection
   */
  async addConnection(connection) {
    const { name } = connection;
    const proxy = await this.client.proxy(CONNECTIONS_IFACE, CONNECTIONS_PATH);
    const ctype = (connection.wireless) ? DeviceType.WIRELESS : DeviceType.ETHERNET;
    const path = await proxy.AddConnection(name, ctype);
    await this.updateConnectionAt(path, { ...connection, id: name });
    return this.connectionFromPath(path);
  }

  /**
   * Returns the connection with the given ID
   *
   * @param {string} uuid - Connection ID
   * @return {Promise<Connection|undefined>}
   */
  async getConnection(uuid) {
    const path = await this.getConnectionPath(uuid);
    if (path) {
      return this.connectionFromPath(path);
    }
  }

  /**
   * Returns a connection from the given D-Bus path
   *
   * @param {string} path - Path of the D-Bus object representing the connection
   * @return {Promise<Connection>}
   */
  async connectionFromPath(path) {
    const connection = await this.proxies.connections[path];
    const ip = await this.proxies.ipConfigs[path];

    const conn = {
      id: connection.Id,
      uuid: connection.Uuid,
      name: connection.Interface,
      ipv4: {
        method: ip.Method4,
        nameServers: ip.Nameservers,
        addresses: ip.Addresses.map(addr => {
          const [address, prefix] = addr.split("/");
          return { address, prefix };
        }),
        gateway: ip.Gateway4
      },
    };

    const wireless = await this.proxies.wireless[path];
    if (wireless) {
      conn.wireless = {
        ssid: window.atob(wireless.SSID),
        hidden: false, // TODO implement the 'hidden' property
        mode: wireless.Mode,
        security: wireless.Security // see AgamaSecurityProtocols
      };
    }

    return createConnection(conn);
  }

  /**
   * Sets a property for a given path
   *
   * @param {string} path - Object path.
   * @param {string} iface - Interface name.
   * @param {string} property - Property name.
   * @param {object} value - Property value. The value should be created by
   * using the cockpit.variant() function.
   */
  async setProperty(path, iface, property, value) {
    return this.client.call(path, "org.freedesktop.DBus.Properties", "Set", [iface, property, value]);
  }

  /**
   * Returns the D-Bus path of the connection.
   *
   * @param {string} uuid - Connection UUID
   * @return {Promise<string|undefined>} - Connection D-Bus path
   */
  async getConnectionPath(uuid) {
    for (const path in this.proxies.connections) {
      const proxy = await this.proxies.connections[path];
      if (proxy.Uuid === uuid) {
        return path;
      }
    }
  }

  /**
   * Updates the connection
   *
   * It uses the 'uuid' to match the connection in the backend.
   *
   * @param {Connection} connection - Connection to update
   * @return {Promise<boolean>} - the promise resolves to true if the connection
   *   was successfully updated and to false it it does not exist.
   */
  async updateConnection(connection) {
    const path = await this.getConnectionPath(connection.uuid);
    if (path === undefined) {
      return false;
    }

    await this.updateConnectionAt(path, connection);
    return true;
  }

  /**
   * Updates the connection in the given path
   *
   *
   * @param {string} path - D-Bus path of the connection to update.
   * @param {Connection} connection - Connection to update.
   */
  async updateConnectionAt(path, connection) {
    const { ipv4, wireless } = connection;
    await this.setProperty(path, IP_IFACE, "Method4", cockpit.variant("s", ipv4.method));
    await this.setProperty(path, IP_IFACE, "Gateway4", cockpit.variant("s", ipv4.gateway));
    const addresses = ipv4.addresses.map(a => `${a.address}/${a.prefix}`);
    await this.setProperty(path, IP_IFACE, "Addresses", cockpit.variant("as", addresses));
    await this.setProperty(path, IP_IFACE, "Nameservers", cockpit.variant("as", ipv4.nameServers));

    if (wireless) {
      await this.setProperty(path, WIRELESS_IFACE, "Mode", cockpit.variant("s", "infrastructure"));
      if (wireless.password) {
        await this.setProperty(path, WIRELESS_IFACE, "Password", cockpit.variant("s", wireless.password));
      }
      await this.setProperty(path, WIRELESS_IFACE, "Security", cockpit.variant("s", wireless.security));
      const ssid = cockpit.byte_array(wireless.ssid);
      await this.setProperty(path, WIRELESS_IFACE, "SSID", cockpit.variant("ay", ssid));
    }

    // TODO: apply the changes only in this connection
    return this.proxies.connectionsRoot.Apply();
  }

  /**
   * Deletes the connection
   *
   * It uses the 'path' to match the connection in the backend.
   *
   * @param {Connection} connection - Connection to delete
   */
  async deleteConnection(connection) {
    const proxy = await this.client.proxy(CONNECTIONS_IFACE, CONNECTIONS_PATH);
    const conn = await this.getConnection(connection.uuid);
    await proxy.RemoveConnection(conn.id);
    return this.proxies.connectionsRoot.Apply();
  }

  /*
   * Returns list of IP addresses for all active NM connections
   *
   * @todo remove duplicates
   * @private
   * @return {Promise<IPAddress[]>}
   */
  addresses() {
    const conns = this.activeConnections();
    return conns.flatMap(c => c.addresses);
  }

  /*
  * Returns network general settings
  */
  settings() {
    return this.nm.settings();
  }
}

export {
  ConnectionState,
  ConnectionTypes,
  NetworkClient,
  NetworkEventTypes
};
