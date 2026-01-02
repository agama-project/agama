/*
 * Copyright (c) [2022-2025] SUSE LLC
 *
 * All Rights Reserved.
 *
 * This program is free software; you can redistribute it and/or modify it
 * under the terms of the GNU General Public License as published by the Free
 * Software Foundation; either version 2 of the License, or (at your option)
 * any later version.
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

import ipaddr from "ipaddr.js";
import { isUndefined } from "radashi";
import {
  APIRoute,
  ApFlags,
  ApSecurityFlags,
  Connection,
  ConnectionBindingMode,
  Device,
  IPAddress,
  Route,
  SecurityProtocols,
} from "~/types/network";

/**
 * Check if an IP is valid
 *
 * @note By now, only IPv4 is supported.
 *
 * @param value - An IP Address
 * @return true if given IP is valid; false otherwise.
 */
const isValidIp = (value: IPAddress["address"]) => ipaddr.IPv4.isValidFourPartDecimal(value);

/**
 * Check if a value is a valid netmask or network prefix
 *
 * @note By now, only IPv4 is supported.
 *
 * @param value - An netmask or a network prefix
 * @return true if given IP is valid; false otherwise.
 */
const isValidIpPrefix = (value: IPAddress["prefix"]) => {
  const prefix = String(value);

  if (prefix.match(/^\d+$/)) {
    return parseInt(prefix) <= 32;
  } else {
    return ipaddr.IPv4.isValidFourPartDecimal(prefix);
  }
};

/**
 * Prefix for the given prefix or netmask
 *
 * @note By now, only IPv4 is supported.
 *
 * @param value - An netmask or a network prefix
 * @return prefix for the given netmask or prefix
 */
const ipPrefixFor = (value: string | number): number => {
  if (typeof value === "number") return value;

  if (value.match(/^\d+$/)) {
    return parseInt(value);
  } else {
    return ipaddr.IPv4.parse(value).prefixLengthFromSubnetMask();
  }
};

/**
 *  Converts an IP given in decimal format to text format
 *
 * FIXME: IPv6 is not supported yet.
 *
 * @param address - An IP Address as network byte-order
 * @return given address as string, when possible
 */
const intToIPString = (address: number): string | null => {
  const ip = ipaddr.parse(address.toString());
  if ("octets" in ip) {
    return ip.octets.reverse().join(".");
  } else {
    return null;
  }
};

/** Convert a IP address from text to network byte-order
 *
 * FIXME: Currently it is assumed 'le' ordering which should be read from NetworkManager State
 *
 * @param text - string representing an IPv4 address
 * @return IP address as network byte-order
 */
const stringToIPInt = (text: string): number => {
  if (text === "") return 0;

  const parts = text.split(".");
  const bytes = parts.map((s) => parseInt(s.trim()));

  let num = 0;
  const shift = (b) => 0x100 * num + b;
  for (const n of bytes.reverse()) {
    num = shift(n);
  }

  return num;
};

/**
 * Returns given IP address in the X.X.X.X/YY format
 */
const formatIp = (addr: IPAddress, options = { removePrefix: false }): string => {
  if (isUndefined(addr.prefix) || options.removePrefix) {
    return addr.address;
  }

  return `${addr.address}/${ipPrefixFor(addr.prefix)}`;
};

const buildAddress = (address: string): IPAddress => {
  const [ip, netmask] = address.split("/");
  const result: IPAddress = { address: ip };
  if (netmask) result.prefix = ipPrefixFor(netmask);
  return result;
};

/**
 * @param flags - AP flags
 * @param wpaFlags - AP WPA1 flags
 * @param rsnFlags - AP WPA2 flags
 * @return supported security protocols
 */
const securityFromFlags = (
  flags: number,
  wpaFlags: number,
  rsnFlags: number,
): SecurityProtocols[] => {
  const security = [];

  if (flags & ApFlags.PRIVACY && wpaFlags === 0 && rsnFlags === 0) {
    security.push(SecurityProtocols.WEP);
  }

  if (wpaFlags > 0) {
    security.push(SecurityProtocols.WPA);
  }
  if (rsnFlags > 0) {
    security.push(SecurityProtocols.RSN);
  }
  if (wpaFlags & ApSecurityFlags.KEY_MGMT_8021_X || rsnFlags & ApSecurityFlags.KEY_MGMT_8021_X) {
    security.push(SecurityProtocols._8021X);
  }

  return security;
};

const buildAddresses = (rawAddresses?: string[]): IPAddress[] =>
  rawAddresses?.map(buildAddress) || [];

const buildRoutes = (rawRoutes?: APIRoute[]): Route[] => {
  if (!rawRoutes) return [];

  return rawRoutes.map((route) => ({ ...route, destination: buildAddress(route.destination) }));
};

/**
 * Returns addresses IP addresses for given connection
 *
 * Looks for them in the associated device first, if any.
 */
const connectionAddresses = (connection: Connection, devices: Device[]): string => {
  const device = devices?.find(
    ({ connection: deviceConnectionId }) => connection.id === deviceConnectionId,
  );
  const addresses = device ? device.addresses : connection.addresses;

  return addresses?.map(formatIp).join(", ");
};

/**
 * Returns the binding mode for the given connection.
 */
const connectionBindingMode = (connection: Connection): ConnectionBindingMode => {
  if (connection.macAddress) {
    return "mac";
  } else if (connection.iface) {
    return "iface";
  } else {
    return "none";
  }
};

export {
  buildAddress,
  buildAddresses,
  buildRoutes,
  connectionAddresses,
  connectionBindingMode,
  formatIp,
  intToIPString,
  ipPrefixFor,
  isValidIp,
  isValidIpPrefix,
  securityFromFlags,
  stringToIPInt,
};
