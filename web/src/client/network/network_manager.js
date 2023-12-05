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
import DBusClient from "../dbus";
import cockpit from "../../lib/cockpit";
import { NetworkEventTypes } from "./index";
import { createAccessPoint, createConnection, SecurityProtocols } from "./model";
import { ipPrefixFor } from "./utils";

/**
 * @typedef {import("./model").NetworkSettings} NetworkSettings
 * @typedef {import("./model").Connection} Connection
 * @typedef {import("./model").ActiveConnection} ActiveConnection
 * @typedef {import("./model").IPAddress} IPAddress
 * @typedef {import("./model").AccessPoint} AccessPoint
 * @typedef {import("./index").NetworkEventFn} NetworkEventFn
 */

const SERVICE_NAME = "org.freedesktop.NetworkManager";
const IFACE = "org.freedesktop.NetworkManager";
const SETTINGS_IFACE = "org.freedesktop.NetworkManager.Settings";
const CONNECTION_IFACE = "org.freedesktop.NetworkManager.Settings.Connection";
const DEVICE_IFACE = "org.freedesktop.NetworkManager.Device";
const DEVICES_NAMESPACE = "/org/freedesktop/NetworkManager/Devices";
const ACTIVE_CONNECTION_IFACE = "org.freedesktop.NetworkManager.Connection.Active";
const ACTIVE_CONNECTION_NAMESPACE = "/org/freedesktop/NetworkManager/ActiveConnection";
const IP4CONFIG_IFACE = "org.freedesktop.NetworkManager.IP4Config";
const IP4CONFIG_NAMESPACE = "/org/freedesktop/NetworkManager/IP4Config";
const ACCESS_POINT_IFACE = "org.freedesktop.NetworkManager.AccessPoint";
const ACCESS_POINT_NAMESPACE = "/org/freedesktop/NetworkManager/AccessPoint";
const SETTINGS_NAMESPACE = "/org/freedesktop/NetworkManager/Settings";
const NM_DEVICE_TYPE_WIFI = 2;

const ApFlags = Object.freeze({
  NONE: 0x00000000,
  PRIVACY: 0x00000001,
  WPS: 0x00000002,
  WPS_PBC: 0x00000004,
  WPS_PIN: 0x00000008
});

const ApSecurityFlags = Object.freeze({
  NONE: 0x00000000,
  PAIR_WEP40: 0x00000001,
  PAIR_WEP104: 0x00000002,
  PAIR_TKIP: 0x00000004,
  PAIR_CCMP: 0x00000008,
  GROUP_WEP40: 0x00000010,
  GROUP_WEP104: 0x00000020,
  GROUP_TKIP: 0x00000040,
  GROUP_CCMP: 0x00000080,
  KEY_MGMT_PSK: 0x00000100,
  KEY_MGMT_8021_X: 0x00000200,
});

/**
* @param {number} flags - AP flags
* @param {number} wpa_flags - AP WPA1 flags
* @param {number} rsn_flags - AP WPA2 flags
* @return {string[]} security protocols supported
*/
const securityFromFlags = (flags, wpa_flags, rsn_flags) => {
  const security = [];

  if ((flags & ApFlags.PRIVACY) && (wpa_flags === 0) && (rsn_flags === 0))
    security.push(SecurityProtocols.WEP);

  if (wpa_flags > 0)
    security.push(SecurityProtocols.WPA);
  if (rsn_flags > 0)
    security.push(SecurityProtocols.RSN);
  if ((wpa_flags & ApSecurityFlags.KEY_MGMT_8021_X) || (rsn_flags & ApSecurityFlags.KEY_MGMT_8021_X))
    security.push(SecurityProtocols._8021X);

  return security;
};

/**
 * @param {Connection} connection - Connection to convert
 */
const connectionToCockpit = (connection) => {
  const { ipv4, wireless } = connection;
  const settings = {
    connection: {
      id: cockpit.variant("s", connection.name)
    },
    ipv4: {
      "address-data": cockpit.variant("aa{sv}", ipv4.addresses.map(addr => (
        {
          address: cockpit.variant("s", addr.address),
          prefix: cockpit.variant("u", ipPrefixFor(addr.prefix.toString()))
        }
      ))),
      "dns-data": cockpit.variant("as", ipv4.nameServers),
      method: cockpit.variant("s", ipv4.method)
    }
  };

  if (ipv4.gateway && connection.ipv4.addresses.length !== 0) {
    settings.ipv4.gateway = cockpit.variant("s", ipv4.gateway);
  }

  if (wireless) {
    settings.connection.type = cockpit.variant("s", "802-11-wireless");
    settings["802-11-wireless"] = {
      mode: cockpit.variant("s", "infrastructure"),
      ssid: cockpit.variant("ay", cockpit.byte_array(wireless.ssid)),
      hidden: cockpit.variant("b", !!wireless.hidden)
    };

    if (wireless.security) {
      settings["802-11-wireless-security"] = {
        "key-mgmt": cockpit.variant("s", wireless.security),
        psk: cockpit.variant("s", wireless.password)
      };
    }
  }

  return settings;
};

/**
 * It merges the information from a connection into a D-Bus settings object
 *
 * @param {object} settings - Settings from the GetSettings D-Bus method
 * @param {Connection} connection - Connection containing the information to update
 * @return {object} Object to be used with the UpdateConnection D-Bus method
 */
const mergeConnectionSettings = (settings, connection) => {
  // We need to delete these keys or otherwise they have precedence over the key-data ones
  const { addresses, gateway, dns, ...cleanIPv4 } = settings.ipv4 || {};
  const { connection: conn, ipv4 } = connectionToCockpit(connection);

  return {
    ...settings,
    connection: {
      ...settings.connection,
      ...conn
    },
    ipv4: {
      ...cleanIPv4,
      ...ipv4
    }
  };
};

/**
 * NetworkClient adapter for NetworkManager
 *
 * This class is responsible for providing an interface to interact with NetworkManager through
 * D-Bus. Its interface is modeled to serve NetworkClient requirements.
 */
class NetworkManagerAdapter {
  constructor() {
    this.client = new DBusClient(SERVICE_NAME);
    this.proxies = {
      accessPoints: {},
      activeConnections: {},
      devices: {},
      ip4Configs: {},
      manager: null,
      settings: null,
      connections: {}
    };
    this.eventsHandler = null;
  }

  /**
   * Builds proxies and starts listening to them
   *
   * @param {NetworkEventFn} handler - Events handler
   */
  async setUp(handler) {
    this.eventsHandler = handler;
    this.proxies = {
      accessPoints: await this.client.proxies(ACCESS_POINT_IFACE, ACCESS_POINT_NAMESPACE),
      activeConnections: await this.client.proxies(
        ACTIVE_CONNECTION_IFACE, ACTIVE_CONNECTION_NAMESPACE
      ),
      devices: await this.client.proxies(DEVICE_IFACE, DEVICES_NAMESPACE),
      ip4Configs: await this.client.proxies(IP4CONFIG_IFACE, IP4CONFIG_NAMESPACE),
      manager: await this.client.proxy(IFACE),
      settings: await this.client.proxy(SETTINGS_IFACE),
      connections: await this.client.proxies(CONNECTION_IFACE, SETTINGS_NAMESPACE)
    };
    this.subscribeToEvents();
  }

  /**
   * Returns the list of active connections
   *
   * @return {ActiveConnection[]}
   * @see https://developer-old.gnome.org/NetworkManager/stable/gdbus-org.freedesktop.NetworkManager.html
   */
  activeConnections() {
    return Object.values(this.proxies.activeConnections).map(proxy => {
      return this.activeConnectionFromProxy(proxy);
    });
  }

  /**
   * Returns the list of configured connections
   *
   * @return {Promise<Connection[]>}
   * @see https://developer-old.gnome.org/NetworkManager/stable/gdbus-org.freedesktop.NetworkManager.html
   */
  async connections() {
    return await Promise.all(Object.values(this.proxies.connections).map(async proxy => {
      return await this.connectionFromProxy(proxy);
    }));
  }

  /**
   * Returns the list of available wireless access points (AP)
   *
   * @return {AccessPoint[]}
   */
  accessPoints() {
    return Object.values(this.proxies.accessPoints).map(ap => {
      return createAccessPoint({
        ssid: window.atob(ap.Ssid),
        hwAddress: ap.HwAddress,
        strength: ap.Strength,
        security: securityFromFlags(ap.Flags, ap.WpaFlags, ap.RsnFlags)
      });
    });
  }

  /**
   * Returns a Connection given the nm-settings given by DBUS
   *
   * @param {object} settings - connection options
   * @return {Connection}
   *
   */
  connectionFromSettings(settings) {
    const { connection, ipv4, "802-11-wireless": wireless, path } = settings;
    const conn = {
      id: connection.uuid.v,
      name: connection.id.v,
      type: connection.type.v
    };

    if (path) conn.path = path;

    if (ipv4) {
      conn.ipv4 = {
        addresses: ipv4["address-data"].v.map(({ address, prefix }) => {
          return { address: address.v, prefix: prefix.v };
        }),
        nameServers: ipv4["dns-data"]?.v || [],
        method: ipv4.method.v,
      };
      if (ipv4.gateway?.v) conn.ipv4.gateway = ipv4.gateway.v;
    }

    if (wireless) {
      conn.wireless = {
        ssid: window.atob(wireless.ssid.v),
        hidden: wireless.hidden?.v || false
      };
    }

    return conn;
  }

  /**
   * Returns the connection with the given ID
   *
   * @param {string} id - Connection ID
   * @return {Promise<import("./index").Connection>}
   */
  async getConnection(id) {
    const settingsProxy = await this.connectionSettingsObject(id);
    const settings = await settingsProxy.GetSettings();

    return this.connectionFromSettings(settings);
  }

  /**
   * Connects to given Wireless network
   *
   * @param {object} settings - connection options
   */
  async connectTo(settings) {
    const settingsProxy = await this.connectionSettingsObject(settings.id);
    await this.activateConnection(settingsProxy.path);
  }

  /**
   * Connects to given Wireless network
   *
   * @param {string} ssid - Network id
   * @param {object} options - connection options
   */
  async addAndConnectTo(ssid, options = {}) {
    const wireless = { ssid };
    if (options.security) wireless.security = options.security;
    if (options.password) wireless.password = options.password;
    if (options.hidden) wireless.hidden = options.hidden;

    const connection = createConnection({
      name: ssid,
      wireless
    });

    await this.addConnection(connection);
  }

  /**
   * Adds a new connection
   *
   * @param {Connection} connection - Connection to add
   */
  async addConnection(connection) {
    const proxy = await this.client.proxy(SETTINGS_IFACE);
    const connCockpit = connectionToCockpit(connection);
    const path = await proxy.AddConnection(connCockpit);
    await this.activateConnection(path);
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
    const newSettings = mergeConnectionSettings(settings, connection);
    await settingsProxy.Update(newSettings);
    await this.activateConnection(settingsProxy.path);
  }

  /**
  * Deletes the given connection
  *
   * @param {import("./index").Connection} connection - Connection to delete
  */
  async deleteConnection(connection) {
    const settingsProxy = await this.connectionSettingsObject(connection.id);
    await settingsProxy.Delete();
  }

  /**
   * Subscribes to network events
   *
   * Registers a handler for changes in /org/freedesktop/NetworkManager/ActiveConnection/*.
   * The handler receives a NetworkEvent object.
   *
   * @private
   */
  async subscribeToEvents() {
    const activeConnectionProxies = this.proxies.activeConnections;
    const connectionProxies = this.proxies.connections;
    const managerProxy = this.proxies.manager;
    const settingsProxy = this.proxies.settings;

    /** @type {(eventType: string) => NetworkEventFn} */
    const handleWrapperActiveConnection = (eventType) => (_event, proxy) => {
      const connection = this.activeConnectionFromProxy(proxy);
      this.eventsHandler({ type: eventType, payload: connection });
    };

    /** @type {(eventType: string) => NetworkEventFn} */
    const handleWrapperConnection = (eventType) => async (_event, proxy) => {
      let connection;

      if (eventType === NetworkEventTypes.CONNECTION_REMOVED) {
        connection = { id: proxy.id, path: proxy.path };
      } else {
        connection = await this.connectionFromProxy(proxy);
      }

      this.eventsHandler({ type: eventType, payload: connection });
    };

    const handleWrapperSettings = (eventType) => () => {
      this.eventsHandler({ type: eventType, payload: this.settings() });
    };

    // FIXME: do not build a map (eventTypesMap), just inject the type here
    connectionProxies.addEventListener("added", handleWrapperConnection(NetworkEventTypes.CONNECTION_ADDED));
    connectionProxies.addEventListener("changed", handleWrapperConnection(NetworkEventTypes.CONNECTION_UPDATED));
    connectionProxies.addEventListener("removed", handleWrapperConnection(NetworkEventTypes.CONNECTION_REMOVED));

    // FIXME: do not build a map (eventTypesMap), just inject the type here
    activeConnectionProxies.addEventListener("added", handleWrapperActiveConnection(NetworkEventTypes.ACTIVE_CONNECTION_ADDED));
    activeConnectionProxies.addEventListener("changed", handleWrapperActiveConnection(NetworkEventTypes.ACTIVE_CONNECTION_UPDATED));
    activeConnectionProxies.addEventListener("removed", handleWrapperActiveConnection(NetworkEventTypes.ACTIVE_CONNECTION_REMOVED));

    managerProxy.addEventListener("changed", handleWrapperSettings(NetworkEventTypes.SETTINGS_UPDATED));
    settingsProxy.addEventListener("changed", handleWrapperSettings(NetworkEventTypes.SETTINGS_UPDATED));
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
    const proxy = await this.client.proxy(IFACE);
    return proxy.ActivateConnection(path, "/", "/");
  }

  /**
   * Builds a connection object from a Cockpit's proxy object
   *
   * It retrieves additional information like IPv4 settings.
   *
   * @private
   * @param {object} proxy - Proxy object from /org/freedesktop/NetworkManager/Settings/*
   * @return {Promise<import("./index").Connection>}
   */
  async connectionFromProxy(proxy) {
    const settings = await proxy.GetSettings();
    settings.path = proxy.path;
    return this.connectionFromSettings(settings);
  }

  /**
   * Builds a connection object from a Cockpit's proxy object
   *
   * It retrieves additional information like IPv4 settings.
   *
   * @private
   * @param {object} proxy - Proxy object from /org/freedesktop/NetworkManager/ActiveConnection/*
   * @return {ActiveConnection}
   */
  activeConnectionFromProxy(proxy) {
    const ip4Config = this.proxies.ip4Configs[proxy.Ip4Config];
    let addresses = [];
    if (ip4Config) {
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
   *
   * Returns connection settings for the given connection
   *
   * @private
   * @param {string} id - Connection ID
   * @return {Promise<any>}
   */
  async connectionSettingsObject(id) {
    const proxy = await this.client.proxy(SETTINGS_IFACE);
    const path = await proxy.GetConnectionByUuid(id);
    return await this.client.proxy(CONNECTION_IFACE, path);
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

  /*
  * Returns the list of WiFi devices available in the system
  *
  * @return {object[]} list of available WiFi devices
  */
  availableWifiDevices() {
    return Object.values(this.proxies.devices).filter(d => d.DeviceType === NM_DEVICE_TYPE_WIFI);
  }

  /*
  * Returns whether the system is able to scan wifi networks based on rfkill and the presence of
  * some wifi device
  *
  * @return {boolean}
  */
  wifiScanSupported() {
    const { manager } = this.proxies;

    if (!manager) return false;
    if (!(manager.WirelessEnabled && manager.WirelessHardwareEnabled)) return false;

    return this.availableWifiDevices().length > 0;
  }

  /*
  * Returns NetworkManager general settings
  *
  * @return {NetworkSettings}
  */
  settings() {
    return {
      wifiScanSupported: this.wifiScanSupported(),
      hostname: this.proxies.settings?.Hostname || ""
    };
  }
}

export { NetworkManagerAdapter, mergeConnectionSettings, securityFromFlags };
