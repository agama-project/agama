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

const NETWORK_IFACE = "org.opensuse.DInstaller.Network1";

const CONNECTION_ADDED = "CONNECTIONS_ADDED";
const CONNECTION_UPDATED = "CONNECTION_UPDATED";
const CONNECTION_REMOVED = "CONNECTION_REMOVED";

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
 * @property {string} settings_path
 * @property {string} device_path
 * @property {string} type
 * @property {number} state
 * @property {object} ipv4
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
 * @property {(handler: (event: NetworkEvent) => void) => void} subscribe
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
 * NetworkClient adapter for NetworkManager
 *
 * This class is responsible for providing an interface to interact with NetworkManager through
 * D-Bus. Its interface is modeled to serve NetworkClient requirements.
 */
class NetworkManagerAdapter {
  /**
   * @param {DBusClient} [dbusClient] - D-Bus client
   */
  constructor(dbusClient) {
    this.client = dbusClient || new DBusClient(NM_SERVICE_NAME);
  }

  /**
   * Subscribes to network events
   *
   * Registers a handler for changes in /org/freedesktop/NetworkManager/ActiveConnection/*.
   * The handler recevies a NetworkEvent object.
   *
   * @param {(event: NetworkEvent) => void} handler - Event handler function
   */
  async subscribe(handler) {
    const proxies = await this.client.proxies(
      "org.freedesktop.NetworkManager.Connection.Active",
      "/org/freedesktop/NetworkManager/ActiveConnection",
      { watch: true }
    );

    proxies.addEventListener("added", (_event, proxy) => {
      proxy.wait(() => {
        this.connectionFromProxy(proxy).then(connection => {
          handler({ type: CONNECTION_ADDED, payload: connection });
        });
      });
    });

    proxies.addEventListener("changed", (_event, proxy) => {
      proxy.wait(() => {
        this.connectionFromProxy(proxy).then(connection => {
          handler({ type: CONNECTION_UPDATED, payload: connection });
        });
      });
    });

    proxies.addEventListener("removed", (_event, proxy) => {
      handler({ type: CONNECTION_REMOVED, payload: proxy.path });
    });
  }

  /**
   * Updates the connection
   *
   * @fixme improve it.
   *
   * @param {Connection} connection - Connection to update
   */
  async updateConnection(connection) {
    const settingsObject = await this.client.proxy(NM_CONNECTION_IFACE, connection.settings_path);
    const settings = await settingsObject.GetSettings();

    delete settings.ipv4.addresses;
    delete settings.ipv4["address-data"];
    delete settings.ipv4.gateway;
    delete settings.ipv4.dns;

    const newSettings = {
      ...settings,
      connection: {
        ...settings.connection,
        id: cockpit.variant("s", connection.id)
      },
      ipv4: {
        ...settings.ipv4,
        "address-data": cockpit.variant("aa{sv}", connection.ipv4.addresses.map(addr => (
          {
            address: cockpit.variant("s", addr.address),
            prefix: cockpit.variant("u", parseInt(addr.prefix))
          }
        ))
        ),
        dns: cockpit.variant("au", connection.ipv4.dns),
        method: cockpit.variant("s", connection.ipv4.method)
      }
    };

    // FIXME: find a better way to add gateway only if there are addresses. If not, a DBusError will
    // be raises "gateway cannot be set if there are no addresses configured".
    if ((connection.ipv4.gateway) && (newSettings.ipv4["address-data"].v.length !== 0)) {
      newSettings.ipv4.gateway = cockpit.variant("s", connection.ipv4.gateway);
    }

    console.log(newSettings);

    await settingsObject.Update(newSettings);
    await this.activateConnection(connection);
  }

  /**
   * Reactivate the given connection
   *
   * @private
   * @param {Connection} connection
   * See NM API documentation for details.
   * https://developer-old.gnome.org/NetworkManager/stable/gdbus-org.freedesktop.NetworkManager.html
   */
  async activateConnection(connection) {
    const proxy = await this.client.proxy(NM_IFACE);
    return proxy.ActivateConnection(connection.settings_path, connection.device_path, "/");
  }

  /**
   * Builds a connection object from a Cockpit's proxy object
   *
   * It retrieves additional information like IPv4 settings.
   *
   * @private
   * @param {object} proxy - Proxy object from /org/freedesktop/NetworkManager/ActiveConnection/*
   * @return Promise<Connection>
   */
  async connectionFromProxy(proxy) {
    const settings = await this.connectionSettings(proxy.Connection);
    const { ipv4 } = settings;
    let addresses = [];

    if (proxy.State === CONNECTION_STATE.ACTIVATED) {
      const ip4Config = await this.client.proxy(NM_IP4CONFIG_IFACE, proxy.Ip4Config);
      addresses = ip4Config.AddressData.map(this.connectionIPAddress);
    }

    return {
      id: proxy.Id,
      path: proxy.Connection,
      settings_path: proxy.Connection,
      device_path: proxy.Devices[0],
      ipv4,
      addresses,
      type: proxy.Type,
      state: proxy.State
    };
  }

  /**
   *
   * Returns connection settings for the given connection
   *
   * @param {string} connectionPath
   * @return { Promise<any> }
   */
  async connectionSettings(connectionPath) {
    const proxy = await this.client.proxy(NM_CONNECTION_IFACE, connectionPath);
    const settings = await proxy.GetSettings();
    return settings;
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
   * @param {DBusClient} [dbusClient] - D-Bus client
   */
  constructor(adapter, dbusClient) {
    /** @type {!boolean} */
    this.subscribed = false;
    /** @type {Handlers} */
    this.handlers = {
      connectionAdded: [],
      connectionRemoved: [],
      connectionUpdated: []
    };
    this.client = dbusClient || new DBusClient("org.opensuse.DInstaller");
    this.adapter = adapter || new NetworkManagerAdapter(this.client);
  }

  /**
   * Returns IP config overview - addresses, connections and hostname
   * @return {Promise<{ addresses: IPAddress[], hostname: string, connections: Connection[]}>}
   */
  async config() {
    return {
      connections: await this.activeConnections(),
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
    this.subscribed = true;

    this.adapter.subscribe(({ type, payload }) => {
      switch (type) {
        case CONNECTION_ADDED: {
          this.handlers.connectionAdded.forEach(handler => handler(payload));
          break;
        }

        case CONNECTION_UPDATED: {
          this.handlers.connectionUpdated.forEach(handler => handler(payload));
          break;
        }

        case CONNECTION_REMOVED: {
          this.handlers.connectionRemoved.forEach(handler => handler(payload.path));
          break;
        }
      }
    });
  }

  /**
   * Returns the active connections
   *
   * @returns { Promise<Connection[]> }
   */
  async activeConnections() {
    const proxy = await this.client.proxy(NETWORK_IFACE);
    return proxy.ActiveConnections.map(conn => {
      const { id, path, ipv4, state, type } = conn;
      const { method, gateway } = ipv4.v;
      const addresses = ipv4.v.addresses.v.map(({ v: { address, prefix } }) => {
        return { address: address.v, prefix: prefix.v };
      });
      return {
        id: id.v,
        path: path.v,
        state: state.v,
        type: type.v,
        ipv4: { method: method.v, gateway: gateway.v },
        addresses
      };
    });
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
    const conns = await this.activeConnections();
    return conns.flatMap(c => c.addresses);
  }
}

export { CONNECTION_STATE, CONNECTION_TYPES, formatIp, NetworkClient, NetworkManagerAdapter };
