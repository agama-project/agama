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

import ipaddr from "ipaddr.js";

/**
 * @typedef {import("./model").IPAddress} IPAddress
 */

/**
 * Check if an IP is valid
 *
 * By now, only IPv4 is supported.
 *
 * @param {string} value - An IP Address
 * @return {boolean} true if given IP is valid; false otherwise.
 */
const isValidIp = (value) => ipaddr.IPv4.isValidFourPartDecimal(value);

/**
 * Check if a value is a valid netmask or network prefix
 *
 * By now, only IPv4 is supported.
 *
 * @param {string} value - An netmask or a network prefix
 * @return {boolean} true if given IP is valid; false otherwise.
 */
const isValidIpPrefix = (value) => {
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
const ipPrefixFor = (value) => {
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
const intToIPString = (address) => {
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
const stringToIPInt = (text) => {
  if (text === "")
    return 0;

  const parts = text.split(".");
  const bytes = parts.map((s) => parseInt(s.trim()));

  let num = 0;
  const shift = (b) => 0x100 * num + b;
  for (const n of bytes.reverse()) { num = shift(n) }

  return num;
};

/**
 * Returns given IP address in the X.X.X.X/YY format
 *
 * @param {IPAddress} addr
 * @return {string}
 */
const formatIp = (addr) => {
  if (addr.prefix === undefined) {
    return `${addr.address}`;
  } else {
    return `${addr.address}/${addr.prefix}`;
  }
};

export {
  isValidIp,
  isValidIpPrefix,
  intToIPString,
  stringToIPInt,
  formatIp,
  ipPrefixFor
};
