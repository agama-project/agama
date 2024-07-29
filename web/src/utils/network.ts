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

import ipaddr from "ipaddr.js";
import { ApFlags, ApSecurityFlags, ConnectionState, IPAddress, SecurityProtocols } from "~/types/network";

/**
 * Returns a human readable connection state
 *
 * @property {number} state
 * @return {string}
 */
const connectionHumanState = (state: number): string => {
  const stateIndex = Object.values(ConnectionState).indexOf(state);
  const stateKey = Object.keys(ConnectionState)[stateIndex];
  return stateKey.toLowerCase();
};

/**
 * Check if an IP is valid
 *
 * By now, only IPv4 is supported.
 *
 * @param {string} value - An IP Address
 * @return {boolean} true if given IP is valid; false otherwise.
 */
const isValidIp = (value: string): boolean => ipaddr.IPv4.isValidFourPartDecimal(value);

/**
 * Check if a value is a valid netmask or network prefix
 *
 * By now, only IPv4 is supported.
 *
 * @param {string} value - An netmask or a network prefix
 * @return {boolean} true if given IP is valid; false otherwise.
 */
const isValidIpPrefix = (value: string): boolean => {
  if (value.match(/^\d+$/)) {
    return parseInt(value) <= 32;
  } else {
    return ipaddr.IPv4.isValidFourPartDecimal(value);
  }
};

/**
 * Prefix for the given prefix or netmask
 *
 * By now, only IPv4 is supported.
 *
 * @param {string} value - An netmask or a network prefix
 * @return {number} prefix for the given netmask or prefix
 */
const ipPrefixFor = (value: string): number => {
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
 * @param {number} address - An IP Address as network byte-order
 * @return {string|null} the address given as a string
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
 * @param {string} text - string representing an IPv4 address
 * @return {number} IP address as network byte-order
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
 *
 * @param {IPAddress} addr
 * @return {string}
 */
const formatIp = (addr: IPAddress): string => {
  if (addr.prefix === undefined) {
    return `${addr.address}`;
  } else {
    return `${addr.address}/${addr.prefix}`;
  }
};

/**
 * @param {number} flags - AP flags
 * @param {number} wpa_flags - AP WPA1 flags
 * @param {number} rsn_flags - AP WPA2 flags
 * @return {string[]} security protocols supported
 */

const securityFromFlags = (flags: number, wpa_flags: number, rsn_flags: number): string[] => {
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



export { connectionHumanState, isValidIp, isValidIpPrefix, intToIPString, stringToIPInt, formatIp, ipPrefixFor, securityFromFlags };
