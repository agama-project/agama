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
import DBusClient from "../dbus";
import { NetworkManagerAdapter } from "./network_manager";
import cockpit from "../../lib/cockpit";
import { createConnection } from "./model";

const SERVICE_NAME = "org.opensuse.Agama1";
const CONNECTIONS_IFACE = "org.opensuse.Agama1.Network.Connections";
const CONNECTIONS_PATH = "/org/opensuse/Agama1/Network/connections";
const CONNECTION_IFACE = "org.opensuse.Agama1.Network.Connection";
const CONNECTIONS_NAMESPACE = "/org/opensuse/Agama1/Network/connections";
const IP_IFACE = "org.opensuse.Agama1.Network.Connection.IP";
const WIRELESS_IFACE = "org.opensuse.Agama1.Network.Connection.Wireless";

/**
 * @typedef {import("./index").NetworkEventFn} NetworkEventFn
 * @typedef {import("./model").Connection} Connection
 */

/**
 * NetworkClient adapter for Agama network service
 */
class AgamaNetworkAdapter {
  /**
   * @param {string} address - D-Bus address
   */
  constructor(address) {
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
  }

  /**
   * Set up the client
   *
   * @param {NetworkEventFn} handler - Events handler
   */
  async setUp(handler) {
    if (this.setUpDone) return;

    this.proxies = {
      connectionsRoot: await this.client.proxy(CONNECTIONS_IFACE, CONNECTIONS_PATH),
      connections: await this.client.proxies(CONNECTION_IFACE, CONNECTIONS_NAMESPACE),
      ipConfigs: await this.client.proxies(IP_IFACE, CONNECTIONS_NAMESPACE),
      wireless: await this.client.proxies(WIRELESS_IFACE, CONNECTIONS_NAMESPACE)
    };
    this.setUpDone = true;
    return this.nm.setUp(handler);
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
  async connections() {
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
    return this.nm.addAndConnectTo(ssid, options);
  }

  /**
   * Adds a new connection
   *
   * @param {Connection} connection - Connection to add
   */
  async addConnection(connection) {
    return this.nm.addConnection(connection);
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
   * Updates the connection
   *
   * It uses the 'path' to match the connection in the backend.
   *
   * @param {Connection} connection - Connection to update
   */
  async updateConnection(connection) {
    const path = await this.getConnectionPath(connection.uuid);
    if (path === undefined) {
      return;
    }

    const { ipv4, wireless } = connection;
    const ipProxy = this.proxies.ipConfigs[path];
    ipProxy.Method4 = ipv4.method;
    ipProxy.Addresses = ipv4.addresses.map(addr => `${addr.address}/${addr.prefix}`);
    ipProxy.Gateway4 = ipv4.gateway;
    ipProxy.Nameservers = ipv4.nameServers;

    if (wireless) {
      const wirelessProxy = this.proxies.wireless[path];
      wirelessProxy.ssid = cockpit.byte_array(wireless.ssid);
      // TODO: handle hidden
      wirelessProxy.hidden = false;
      wirelessProxy.mode = "infrastructure";
    }

    // TODO: apply the changes only in this connection
    this.proxies.connectionsRoot.Apply();
    return true;
  }

  /**
   * Deletes the connection
   *
   * It uses the 'path' to match the connection in the backend.
   *
   * @param {Connection} connection - Connection to delete
   */
  async deleteConnection(connection) {
    return this.nm.deleteConnection(connection);
  }

  /*
   * Returns network general settings
   */
  settings() {
    return this.nm.settings();
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
        ssid: window.atob(wireless.ssid.v),
        hidden: false, // TODO implement the 'hidden' property
        mode: wireless.mode,
        security: wireless.security // see AgamaSecurityProtocols
      };
    }

    return createConnection(conn);
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
}

export { AgamaNetworkAdapter };
