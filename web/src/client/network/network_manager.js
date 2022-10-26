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
//
import { DBusClient } from "../dbus";
import cockpit from "../../lib/cockpit";
import { int_to_text, ip4_from_text } from "../../utils";
import { NetworkEventTypes, ConnectionState } from "./index";

const NM_SERVICE_NAME = "org.freedesktop.NetworkManager";
const NM_IFACE = "org.freedesktop.NetworkManager";
const NM_SETTINGS_IFACE = "org.freedesktop.NetworkManager.Settings";
const NM_CONNECTION_IFACE = "org.freedesktop.NetworkManager.Settings.Connection";
const NM_ACTIVE_CONNECTION_IFACE = "org.freedesktop.NetworkManager.Connection.Active";
const NM_IP4CONFIG_IFACE = "org.freedesktop.NetworkManager.IP4Config";

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
   * Returns the list of active connections
   *
   * @return {Promise<import("./index").ActiveConnection[]>}
   * @see https://developer-old.gnome.org/NetworkManager/stable/gdbus-org.freedesktop.NetworkManager.html
   */
  async activeConnections() {
    const proxy = await this.client.proxy(NM_IFACE);
    let connections = [];
    const paths = await proxy.ActiveConnections;
    for (const path of paths) {
      connections = [...connections, await this.activeConnectionFromPath(path)];
    }
    return connections;
  }

  /**
   * Returns the connection with the given ID
   *
   * @param {string} id - Connection ID
   * @return {Promise<import("./index").Connection>}
   */
  async getConnection(id) {
    const settingsProxy = await this.connectionSettingsObject(id);
    const { connection, ipv4 } = await settingsProxy.GetSettings();
    return {
      id: connection.uuid.v,
      name: connection.id.v,
      ipv4: {
        addresses: ipv4["address-data"].v.map(({ address, prefix }) => {
          return { address: address.v, prefix: prefix.v };
        }),
        // FIXME: handle different byte-order (little-endian vs big-endian)
        nameServers: ipv4.dns?.v.map(int_to_text) || [],
        method: ipv4.method.v,
        gateway: ipv4.gateway?.v
      }
    };
  }

  /**
   * Updates the connection
   *
   * @fixme improve it.
   *
   * @param {import("./index").Connection} connection - Connection to update
   */
  async updateConnection(connection) {
    const settingsProxy = await this.connectionSettingsObject(connection.id);
    const settings = await settingsProxy.GetSettings();

    delete settings.ipv4.addresses;
    delete settings.ipv4["address-data"];
    delete settings.ipv4.gateway;
    delete settings.ipv4.dns;

    const newSettings = {
      ...settings,
      ipv4: {
        ...settings.ipv4,
        "address-data": cockpit.variant("aa{sv}", connection.ipv4.addresses.map(addr => (
          {
            address: cockpit.variant("s", addr.address),
            prefix: cockpit.variant("u", parseInt(addr.prefix))
          }
        ))
        ),
        dns: cockpit.variant("au", connection.ipv4.nameServers.map(ip4_from_text)),
        method: cockpit.variant("s", connection.ipv4.method)
      }
    };

    // FIXME: find a better way to add gateway only if there are addresses. If not, a DBusError will
    // be raises "gateway cannot be set if there are no addresses configured".
    if ((connection.ipv4.gateway) && (newSettings.ipv4["address-data"].v.length !== 0)) {
      newSettings.ipv4.gateway = cockpit.variant("s", connection.ipv4.gateway);
    }

    await settingsProxy.Update(newSettings);
    await this.activateConnection(settingsProxy.path);
  }

  /**
   * Subscribes to network events
   *
   * Registers a handler for changes in /org/freedesktop/NetworkManager/ActiveConnection/*.
   * The handler recevies a NetworkEvent object.
   *
   * @param {(event: import("./index").NetworkEvent) => void} handler - Event handler function
   */
  async subscribe(handler) {
    const proxies = await this.client.proxies(
      NM_ACTIVE_CONNECTION_IFACE,
      "/org/freedesktop/NetworkManager/ActiveConnection",
      { watch: true }
    );

    proxies.addEventListener("added", (_event, proxy) => {
      proxy.wait(() => {
        this.activeConnectionFromProxy(proxy).then(connection => {
          handler({ type: NetworkEventTypes.ACTIVE_CONNECTION_ADDED, payload: connection });
        });
      });
    });

    proxies.addEventListener("changed", (_event, proxy) => {
      proxy.wait(() => {
        this.activeConnectionFromProxy(proxy).then(connection => {
          handler({ type: NetworkEventTypes.ACTIVE_CONNECTION_UPDATED, payload: connection });
        });
      });
    });

    proxies.addEventListener("removed", (_event, proxy) => {
      handler({ type: NetworkEventTypes.ACTIVE_CONNECTION_REMOVED, payload: proxy.path });
    });
  }

  /**
   * Reactivate the given connection
   *
   * @private
   * @param {string} path - connection path
   * See NM API documentation for details.
   * https://developer-old.gnome.org/NetworkManager/stable/gdbus-org.freedesktop.NetworkManager.html
   */
  async activateConnection(path) {
    const proxy = await this.client.proxy(NM_IFACE);
    return proxy.ActivateConnection(path, "/", "/");
  }

  /**
   * Builds a connection object from a Cockpit's proxy object
   *
   * It retrieves additional information like IPv4 settings.
   *
   * @private
   * @param {object} proxy - Proxy object from /org/freedesktop/NetworkManager/ActiveConnection/*
   * @return {Promise<import("./index").ActiveConnection>}
   */
  async activeConnectionFromProxy(proxy) {
    let addresses = [];

    if (proxy.State === ConnectionState.ACTIVATED) {
      const ip4Config = await this.client.proxy(NM_IP4CONFIG_IFACE, proxy.Ip4Config);
      addresses = ip4Config.AddressData.map(this.connectionIPAddress);
    }

    return {
      id: proxy.Uuid,
      name: proxy.Id,
      addresses,
      type: proxy.Type,
      state: proxy.State
    };
  }

  /**
   * Builds a connection object from a D-Bus path.
   *
   * @private
   * @param {string} path - Connection D-Bus path
   * @returns {Promise<import("./index").ActiveConnection>}
   */
  async activeConnectionFromPath(path) {
    const proxy = await this.client.proxy(NM_ACTIVE_CONNECTION_IFACE, path);
    return this.activeConnectionFromProxy(proxy);
  }

  /**
   *
   * Returns connection settings for the given connection
   *
   * @private
   * @param {string} id - Connection ID
   * @return {Promise<any>}
   */
  async connectionSettingsObject(id) {
    const proxy = await this.client.proxy(NM_SETTINGS_IFACE);
    const path = await proxy.GetConnectionByUuid(id);
    return await this.client.proxy(NM_CONNECTION_IFACE, path);
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
    return { address: data.address.v, prefix: parseInt(data.prefix.v) };
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

export { NetworkManagerAdapter };
