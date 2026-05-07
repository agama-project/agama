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
import { isUndefined, title } from "radashi";
import {
  APIRoute,
  ApFlags,
  ApSecurityFlags,
  Connection,
  ConnectionBindingMode,
  ConnectionType,
  Device,
  IPAddress,
  Route,
  SecurityProtocols,
} from "~/types/network";
import { _, N_ } from "~/i18n";

/**
 * Connection type constants.
 *
 * TypeScript enforces that all values match the ConnectionType union.
 */
export const CONNECTION_TYPE = {
  ETHERNET: "ethernet",
  WIFI: "wireless",
  LOOPBACK: "loopback",
  BOND: "bond",
  BRIDGE: "bridge",
  VLAN: "vlan",
  UNKNOWN: "unknown",
} as const satisfies Record<string, ConnectionType>;

/**
 * Translatable labels for connection types.
 */
const CONNECTION_TYPE_LABELS: Record<ConnectionType, string> = {
  [CONNECTION_TYPE.ETHERNET]: N_("Ethernet"),
  [CONNECTION_TYPE.WIFI]: N_("Wi-Fi"),
  [CONNECTION_TYPE.LOOPBACK]: N_("Loopback"),
  [CONNECTION_TYPE.BOND]: N_("Bond"),
  [CONNECTION_TYPE.BRIDGE]: N_("Bridge"),
  [CONNECTION_TYPE.VLAN]: N_("VLAN"),
  [CONNECTION_TYPE.UNKNOWN]: N_("Unknown"),
};

/**
 * Returns the translated label for a connection type.
 */
// eslint-disable-next-line agama-i18n/string-literals
const connectionTypeLabel = (type: ConnectionType): string => _(CONNECTION_TYPE_LABELS[type]);

/**
 * Returns the type for the given connection.
 */
const connectionType = (connection: Connection): ConnectionType => {
  const { wireless, bond } = connection;
  if (wireless) {
    return CONNECTION_TYPE.WIFI;
  } else if (bond) {
    return CONNECTION_TYPE.BOND;
  } else {
    return CONNECTION_TYPE.ETHERNET;
  }
};

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
/** Returns true if the value is a valid IP address, with or without a CIDR prefix. */
const isValidAddress = (value: string): boolean =>
  ipaddr.isValidCIDR(value) || ipaddr.isValid(value);

/** Returns true if the value is a valid IPv4 address, with or without a CIDR prefix. */
const isValidIPv4Address = (value: string): boolean =>
  isValidAddress(value) && ipaddr.IPv4.isValidFourPartDecimal(value.split("/")[0]);

/** Returns true if the value is a valid IPv6 address, with or without a CIDR prefix. */
const isValidIPv6Address = (value: string): boolean =>
  isValidAddress(value) && ipaddr.IPv6.isValid(value.split("/")[0]);

/** Returns true if the value is a valid bare IPv4 address (no CIDR prefix). */
const isValidIPv4 = (value: string): boolean => ipaddr.IPv4.isValidFourPartDecimal(value);

/** Returns true if the value is a valid bare IPv6 address (no CIDR prefix). */
const isValidIPv6 = (value: string): boolean => ipaddr.IPv6.isValid(value);

/** Returns true if the value is a valid nameserver address (bare IPv4 or IPv6, no CIDR). */
const isValidNameserver = (value: string): boolean =>
  ipaddr.IPv4.isValidFourPartDecimal(value) || ipaddr.IPv6.isValid(value);

/**
 * Matches a valid DNS search domain or hostname per RFC 952 / RFC 1123.
 *
 * Rules:
 * - Each label starts and ends with an alphanumeric character.
 * - Labels may contain hyphens but not as the first or last character.
 * - Labels are 1–63 characters long.
 * - Labels are separated by dots.
 * - No trailing dot (NetworkManager does not require one).
 *
 * Examples: `local`, `example.com`, `sub.example.com`.
 */
const DNS_SEARCH_DOMAIN_RE =
  /^(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)*[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?$/;

/** Returns true if the value is a valid DNS search domain or hostname. */
const isValidDNSSearchDomain = (value: string): boolean => DNS_SEARCH_DOMAIN_RE.test(value);

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
function formatIp(addr: IPAddress): string;
function formatIp(addr: IPAddress, options: { removePrefix: boolean }): string;
function formatIp(addr: IPAddress, options = { removePrefix: false }) {
  if (isUndefined(addr.prefix) || options.removePrefix) {
    return addr.address;
  }

  return `${addr.address}/${ipPrefixFor(addr.prefix)}`;
}

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

/**
 * Generates a unique connection name based on type.
 *
 * Returns the connection type (e.g. "Ethernet"). If the name is already
 * taken, a numeric suffix is appended starting at 2 (e.g. "Ethernet 2").
 *
 * @param type - Connection type string (e.g. "ethernet").
 * @param existingIds - Set of already taken connection IDs.
 */
const generateConnectionName = (type: string, existingIds: Set<string>): string => {
  const baseName = title(type);

  if (!existingIds.has(baseName)) return baseName;

  let n = 2;
  while (existingIds.has(`${baseName} ${n}`)) n++;
  return `${baseName} ${n}`;
};

/**
 * IPv4 prefix configuration based on classful networking.
 *
 * Maps first octet ranges to their default CIDR prefix lengths.
 * To change the prefix selection strategy, modify this configuration.
 */
const IPV4_PREFIX_BY_RANGE = new Map([
  [{ min: 1, max: 127 }, 8], // Class A
  [{ min: 128, max: 191 }, 16], // Class B
  [{ min: 192, max: 255 }, 24], // Class C
]);

const IPV6_DEFAULT_PREFIX = 64;

/**
 * Returns the default CIDR prefix for an IPv4 address based on classful networking.
 */
const getDefaultIPv4Prefix = (address: string): number => {
  const firstOctet = parseInt(address.split(".")[0], 10);

  for (const [range, prefix] of IPV4_PREFIX_BY_RANGE) {
    if (firstOctet >= range.min && firstOctet <= range.max) {
      return prefix;
    }
  }

  return 24; // Fallback
};

/**
 * Adds default CIDR prefix to a valid IP address.
 *
 * For IPv4, uses classful networking rules. For IPv6, uses /64.
 *
 * @param address - A valid IPv4 or IPv6 address without a prefix
 * @returns The address with the appropriate default prefix appended
 *
 * @note This function assumes the input is a valid IP address. Callers should
 * validate the address before calling this function.
 */
const addDefaultIPPrefix = (address: string): string => {
  if (isValidIPv4Address(address)) {
    return `${address}/${getDefaultIPv4Prefix(address)}`;
  }

  return `${address}/${IPV6_DEFAULT_PREFIX}`;
};

/**
 * Ensures a value has a default CIDR prefix if it's a valid IP address.
 *
 * Returns the value unchanged if it already has a prefix or is not a valid IP.
 */
const ensureIPPrefix = (value: string): string => {
  if (value.includes("/")) return value;
  if (!isValidIPv4Address(value) && !isValidIPv6Address(value)) return value;
  return addDefaultIPPrefix(value);
};

export {
  addDefaultIPPrefix,
  buildAddress,
  isValidAddress,
  isValidIPv4,
  isValidIPv6,
  isValidIPv4Address,
  isValidIPv6Address,
  isValidNameserver,
  isValidDNSSearchDomain,
  buildAddresses,
  buildRoutes,
  connectionAddresses,
  connectionBindingMode,
  connectionType,
  connectionTypeLabel,
  ensureIPPrefix,
  formatIp,
  generateConnectionName,
  intToIPString,
  ipPrefixFor,
  isValidIp,
  isValidIpPrefix,
  securityFromFlags,
  stringToIPInt,
};
