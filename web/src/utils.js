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

import { useEffect, useRef, useCallback } from "react";
import ipaddr from "ipaddr.js";

/**
 * Returns a new array with a given collection split into two groups, the first holding elements
 * satisfying the filter and the second with those which do not.
 *
 * @param {Array} collection - the collection to be filtered
 * @param {function} filter - the function to be used as filter
 * @return {Array[]} a pair of arrays, [passing, failing]
 */
const partition = (collection, filter) => {
  const pass = [];
  const fail = [];

  collection.forEach(element => {
    filter(element) ? pass.push(element) : fail.push(element);
  });

  return [pass, fail];
};

/**
 * @typedef {Object} cancellableWrapper
 * @property {Promise} promise - Cancellable promise
 * @property {function} cancel - Function for canceling the promise
 */

/**
 * Creates a wrapper object with a cancellable promise and a function for canceling the promise
 *
 * @see useCancellablePromise
 *
 * @param {Promise} promise
 * @returns {cancellableWrapper}
 */
function makeCancellable(promise) {
  let isCanceled = false;

  const cancellablePromise = new Promise((resolve, reject) => {
    promise
      .then((value) => (!isCanceled && resolve(value)))
      .catch((error) => (!isCanceled && reject(error)));
  });

  return {
    promise: cancellablePromise,
    cancel() {
      isCanceled = true;
    }
  };
}

/**
 * Allows using promises in a safer way.
 *
 * This hook is useful for safely performing actions that modify a React component after resolving
 * a promise (e.g., setting the component state once a D-Bus call is answered). Note that nothing
 * guarantees that a React component is still mounted when a promise is resolved.
 *
 *  @see {@link https://overreacted.io/a-complete-guide-to-useeffect/#speaking-of-race-conditions|Race conditions}
 *
 * The hook provides a function for making promises cancellable. All cancellable promises are
 * automatically canceled once the component is unmounted. Note that the promises are not really
 * canceled. In this context, a canceled promise means that the promise will be neither resolved nor
 * rejected. Canceled promises will be destroyed by the garbage collector after unmounting the
 * component.
 *
 * @see {@link https://rajeshnaroth.medium.com/writing-a-react-hook-to-cancel-promises-when-a-component-unmounts-526efabf251f|Cancel promises}
 *
 * @example
 *
 * const { cancellablePromise } = useCancellablePromise();
 * const [state, setState] = useState();
 *
 * useEffect(() => {
 *  const promise = new Promise((resolve) => setTimeout(() => resolve("success"), 6000));
 * // The state is only set if the promise is not canceled
 *  cancellablePromise(promise).then(setState);
 * }, [setState, cancellablePromise]);
 */
function useCancellablePromise() {
  const promises = useRef();

  useEffect(() => {
    promises.current = [];

    return () => {
      promises.current.forEach(p => p.cancel());
      promises.current = [];
    };
  }, []);

  const cancellablePromise = useCallback((promise) => {
    const cancellableWrapper = makeCancellable(promise);
    promises.current.push(cancellableWrapper);
    return cancellableWrapper.promise;
  }, []);

  return { cancellablePromise };
}

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
 * @param {string} value - An IP Address
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
*  Converts an IP given in decimal format to text format
*
* @param {integer} address - An IP Address in Decimal format
* @return {string} the address given as a string
*/
const int_to_text = (address) => {
  const ip = ipaddr.parse(address.toString());

  return ip.octets.reverse().join(".");
};

/**
 *
 * Returns a list of nameservers from the given Connection Ip settings
 *
 * @param {object} config
 * @return { { address: string }[] } list of nameservers in IP format
 *
 */
const dnsFromIpConfig = (config) => {
  const dns = config.dns.v || [];

  return dns.map((address) => ({ address: int_to_text(address) }));
};

/**
 *
 * Returns a list of nameservers from the given Connection Ip settings
 *
 * @param {object} config
 * @return { { address: string, prefix: string }[] } list of nameservers in IP format
 *
 */
const addressesFromIpConfig = (config) => {
  const addresses = config["address-data"]?.v || [];

  return addresses.map((address) => ({ address: address.address.v, prefix: address.prefix.v }));
};

/** Convert a IP address from text to network-byte-order integer
*
* FIXME: Currently it is assumed 'le' ordering which should be read from NetworkManager State
*
* @param {string} IPv4 address
* @return {integer} IP address as network byte order integer
*
*/
const ip4_from_text = (text) => {
  if (text === "")
    return 0;

  console.log(text);

  const parts = text.split(".");
  const bytes = parts.map((s) => parseInt(s.trim()));

  let num = 0;
  const shift = (b) => 0x100 * num + b;
  for (const n of bytes.reverse()) { num = shift(n) }

  return num;
};

export {
  partition,
  useCancellablePromise,
  isValidIp,
  isValidIpPrefix,
  dnsFromIpConfig,
  addressesFromIpConfig,
  ip4_from_text,
  int_to_text
};
