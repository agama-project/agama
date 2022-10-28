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

const SecurityProtocols = Object.freeze({
  WEP: "WEP",
  WPA: "WPA1",
  RSN: "WPA2",
  _8021X: "802.1X"
});

/**
 * @typedef {object} IPAddress
 * @property {string} address - like "129.168.1.2"
 * @property {number|string} prefix - like "16"
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
 * @property {Wireless} [wireless]
 */

/**
 * @typedef {object} Wireless
 * @property {string} password
 * @property {string} ssid
 * @property {string} authMode
 * @property {string} authAlg
 */

/**
 * @typedef {object} IPv4
 * @property {string} method
 * @property {IPAddress[]} addresses
 * @property {string[]} nameServers
 * @property {string} gateway
 */

/**
 * @typedef {object} AccessPoint
 * @property {string} ssid
 * @property {number} strength
 * @property {string} hwAddress
 * @property {string[]} security
 */

/**
 * Returns an IPv4 configuration object
 *
 * Defaults values can be overriden
 *
 * @private
 * @param {object} props
 * @param {string} [props.method]
 * @param {IPAddress[]} [props.addresses]
 * @param {string[]} [props.nameServers]
 * @param {string} [props.gateway]
 * @return {IPv4}
 */
const createIPv4 = ({ method, addresses, nameServers, gateway }) => {
  return {
    method: method || "auto",
    addresses: addresses || [],
    nameServers: nameServers || [],
    gateway: gateway || "",
  };
};

/**
 * Returns a connection object
 *
 * Defaults values can be overriden
 *
 * @param {object} options
 * @param {string} [options.id] - Connection ID
 * @param {string} [options.name] - Connection name
 * @param {object} [options.ipv4] IPv4 Settings
 * @param {object} [options.wireless] Wireless Settings
 * @return {Connection}
 */
const createConnection = ({ id, name, ipv4, wireless }) => {
  const connection = {
    id,
    name,
    ipv4: createIPv4(ipv4 || {}),
  };

  if (wireless) connection.wireless = wireless;

  return connection;
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
const createAccessPoint = ({ ssid, hwAddress, strength, security }) => (
  {
    ssid,
    hwAddress,
    strength,
    security: security || []
  }
);

export {
  createConnection,
  createAccessPoint,
  ConnectionState,
  ConnectionTypes,
  SecurityProtocols
};
