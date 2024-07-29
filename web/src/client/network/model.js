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

import { Connection, ConnectionState } from "~/types/network";

// @ts-check

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

export {
  createAccessPoint,
  createConnection,
  createDevice,
};
