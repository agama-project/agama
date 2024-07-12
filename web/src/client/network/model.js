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

/**
 * Enum for the active connection state values
 *
 * @readonly
 * @enum { number }
 * https://networkmanager.dev/docs/api/latest/nm-dbus-types.html#NMActiveConnectionState
 */
const ConnectionState = Object.freeze({
  UNKNOWN: 0,
  ACTIVATING: 1,
  ACTIVATED: 2,
  DEACTIVATING: 3,
  DEACTIVATED: 4,
});

const DeviceState = Object.freeze({
  UNKNOWN: "unknown",
  UNMANAGED: "unmanaged",
  UNAVAILABLE: "unavailable",
  DISCONNECTED: "disconnected",
  CONFIG: "config",
  IPCHECK: "ipCheck",
  NEEDAUTH: "needAuth",
  ACTIVATED: "activated",
  DEACTIVATING: "deactivating",
  FAILED: "failed",
});

/**
 * Returns a human readable connection state
 *
 * @property {number} state
 * @return {string}
 */
const connectionHumanState = (state) => {
  const stateIndex = Object.values(ConnectionState).indexOf(state);
  const stateKey = Object.keys(ConnectionState)[stateIndex];
  return stateKey.toLowerCase();
};

/**
 * @typedef {keyof ConnectionTypes} ConnectionType
 */

const ConnectionTypes = Object.freeze({
  ETHERNET: "ethernet",
  WIFI: "wireless",
  LOOPBACK: "loopback",
  BOND: "bond",
  BRIDGE: "bridge",
  VLAN: "vlan",
  UNKNOWN: "unknown",
});

const SecurityProtocols = Object.freeze({
  WEP: "WEP",
  WPA: "WPA1",
  RSN: "WPA2",
  _8021X: "802.1X",
});

// security protocols
// const AgamaSecurityProtocols = Object.freeze({
//  WEP: "none",
//  OWE: "owe",
//  DynamicWEP: "ieee8021x",
//  WPA2: "wpa-psk",
//  WPA3Personal: "sae",
//  WPA2Enterprise: "wpa-eap",
//  WPA3Only: "wpa-eap-suite-b-192"
// });

const ApFlags = Object.freeze({
  NONE: 0x00000000,
  PRIVACY: 0x00000001,
  WPS: 0x00000002,
  WPS_PBC: 0x00000004,
  WPS_PIN: 0x00000008,
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
 * @typedef {object} IPAddress
 * @property {string} address - like "129.168.1.2"
 * @property {number|string} prefix - like "16"
 */

/**
 * @typedef {object} Device
 * @property {string} name
 * @property {ConnectionType} type
 * @property {IPAddress[]} addresses
 * @property {string[]} nameservers
 * @property {string} gateway4
 * @property {string} gateway6
 * @property {string} method4
 * @property {string} method6
 * @property {Route[]} routes4
 * @property {Route[]} routes6
 * @property {string} macAddress
 * @property {string} [connection]
 * @property {string} DeviceState
 */

/**
 * @typedef {object} Route
 * @property {IPAddress} destination
 * @property {string} next_hop
 * @property {number} metric
 */

/**
 * @typedef {object} Connection
 * @property {string} id
 * @property {string} iface
 * @property {IPAddress[]} addresses
 * @property {string[]} nameservers
 * @property {string} gateway4
 * @property {string} gateway6
 * @property {string} method4
 * @property {string} method6
 * @property {Wireless} [wireless]
 */

/**
 * @typedef {object} Wireless
 * @property {string} password
 * @property {string} ssid
 * @property {string} security
 * @property {boolean} hidden
 */

/**
 * @typedef {object} AccessPoint
 * @property {string} ssid
 * @property {number} strength
 * @property {string} hwAddress
 * @property {string[]} security
 */

/**
* @typedef {object} NetworkSettings
* @property {boolean} connectivity
* @property {boolean} wireless_enabled
* @property {boolean} networking_enabled
* @property {string} hostname

/**
 * Returns a connection object
 *
 * Defaults values can be overridden
 *
 * @param {object} options
 * @param {string} [options.id] - Connection ID
 * @param {string} [options.method4] - Connection IPv4 method
 * @param {string} [options.method6] - Connection IPv6 method
 * @param {string} [options.gateway4] - Connection IPv4 gateway
 * @param {string} [options.gateway6] - Connection IPv6 gateway
 * @param {string} [options.iface] - Connection interface
 * @param {IPAddress[]} [options.addresses] Connection addresses
 * @param {string[]} [options.nameservers] Connection nameservers
 * @param {object} [options.wireless] Wireless Settings
 * @return {Connection}
 */
const createConnection = ({
  id,
  iface,
  method4,
  method6,
  gateway4,
  gateway6,
  addresses,
  nameservers,
  wireless,
}) => {
  const connection = {
    id,
    iface,
    method4: method4 || "auto",
    method6: method6 || "auto",
    gateway4: gateway4 || "",
    gateway6: gateway6 || "",
    addresses: addresses || [],
    nameservers: nameservers || [],
  };

  if (wireless) connection.wireless = wireless;

  return connection;
};

const createDevice = ({
  name,
  macAddress,
  method4,
  method6,
  gateway4,
  gateway6,
  addresses,
  nameservers,
  routes4,
  routes6,
}) => {
  return {
    name,
    macAddress,
    method4: method4 || "auto",
    method6: method6 || "auto",
    gateway4: gateway4 || "",
    gateway6: gateway6 || "",
    addresses: addresses || [],
    nameservers: nameservers || [],
    routes4: routes4 || [],
    routes6: routes6 || [],
  };
};

/**
 * Returns an access point object
 *
 * @param {object} options
 * @param {string} options.ssid - Network SSID
 * @param {string} options.hwAddress - AP hardware address
 * @param {number} options.strength - Signal strength
 * @param {string[]} [options.security] - Supported security protocols
 * @return {AccessPoint}
 */
const createAccessPoint = ({ ssid, hwAddress, strength, security }) => ({
  ssid,
  hwAddress,
  strength,
  security: security || [],
});

/**
 * @param {number} flags - AP flags
 * @param {number} wpa_flags - AP WPA1 flags
 * @param {number} rsn_flags - AP WPA2 flags
 * @return {string[]} security protocols supported
 */
const securityFromFlags = (flags, wpa_flags, rsn_flags) => {
  const security = [];

  if (flags & ApFlags.PRIVACY && wpa_flags === 0 && rsn_flags === 0) {
    security.push(SecurityProtocols.WEP);
  }

  if (wpa_flags > 0) {
    security.push(SecurityProtocols.WPA);
  }
  if (rsn_flags > 0) {
    security.push(SecurityProtocols.RSN);
  }
  if (wpa_flags & ApSecurityFlags.KEY_MGMT_8021_X || rsn_flags & ApSecurityFlags.KEY_MGMT_8021_X) {
    security.push(SecurityProtocols._8021X);
  }

  return security;
};

export {
  connectionHumanState,
  ConnectionState,
  ConnectionTypes,
  createAccessPoint,
  createConnection,
  createDevice,
  DeviceState,
  securityFromFlags,
  SecurityProtocols,
};
