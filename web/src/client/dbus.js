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

import cockpit from "../lib/cockpit";

/**
 * @typedef {object} DBusValue
 * @property {string} t - type signature
 * @property { * } v - value
 */

/**
 * @typedef {Object.<string, DBusValue>} DBusChanges
 */

/**
 * @callback ChangesHandler
 * @param {DBusChanges} changes
 * @param {string[]} invalid
 * @return {void}
 */

/**
 * @callback SignalHandler
 *
 * @param {string} [interface] - D-Bus interface name
 * @param {string} [path] - D-Bus object path
 * @param {string} [path_namespace] - Prefix of the D-Bus object path. For instance, /foo/bar if you want
 *   to catch signals from /foo/bar/*
 * @param {string} [member] - Signal name
 * @param {string} [arg0] - First element of a D-Bus message
 */

/**
 * @callback RemoveFn
 * @return {void}
 */

/**
 * @typedef {object} SignalMatcher
 * @property {string} [interface] - Interface name
 * @property {string} [path] - Path of the D-Bus object
 * @property {string} [path_namespace] - Prefix of the D-Bus object path. For instance, use /foo/bar
 *                                       if you want to catch signals from /foo/bar/*
 * @property {string} [member] - Signal name
 * @property {string} [arg0] - First element of the D-Bus message
 */

/** Wrapper class around cockpit D-Bus client */
class DBusClient {
  /**
   * @param {string} service - service name
   * @param {string|undefined} address - D-Bus address. If no address is given, it connects
   *   to the "system" bus.
   */
  constructor(service, address = undefined) {
    const options = { superuser: "try" };

    if (address) {
      options.bus = "none";
      options.address = address;
    } else {
      options.bus = "system";
    }

    this.client = cockpit.dbus(service, options);
  }

  /**
   * Registers a proxy for given iface
   *
   * @param {string} iface - D-Bus iface
   * @param {string} [path] - D-Bus object path
   * @return {Promise<object,undefined>} a cockpit DBusProxy or undefined if it
   *   was not possible to create the proxy
   */
  async proxy(iface, path) {
    const proxy = this.client.proxy(iface, path, { watch: true });

    try {
      await proxy.wait();
    } catch (error) {
      console.error("Could not create a proxy for", iface, path, "error=", error);
      return;
    }

    return proxy;
  }

  /**
   * Returns a collection of Cockpit D-Bus proxies
   *
   * @param {string|undefined} iface - Interface name
   * @param {string|undefined} path_namespace - Path namespace
   * @param {object|undefined} options - Proxy options
   * @return {Promise<any>} DBusProxies object
   */
  async proxies(iface, path_namespace, options) {
    const all = await this.client.proxies(iface, path_namespace, { watch: true, ...options });
    await all.wait();
    return all;
  }

  /**
   * Performs a D-Bus call to a given method
   *
   * @param {string} path - D-Bus object path
   * @param {string} iface - D-Bus interface name
   * @param {string} method - Method name
   * @param {any[]} args - Call arguments
   * @return {Promise<any>}
   */
  async call(path, iface, method, args = null) {
    return this.client.call(path, iface, method, args);
  }

  /**
   * Gets a property for a given path and interface
   *
   * @param {string} path - D-Bus object path
   * @param {string} iface - D-Bus interface name
   * @param {string} name - D-Bus property name
   * @return {Promise<any>}
   */
  async getProperty(path, iface, name) {
    let property;

    try {
      const result = await this.client.call(path, "org.freedesktop.DBus.Properties", "Get", [
        iface,
        name,
      ]);
      property = result[0];
    } catch (error) {
      console.warn(`Could not get the ${name} property in ${iface}`, error);
    }

    return property === undefined ? null : property.v;
  }

  /**
   * Register a callback to run when properties change for given D-Bus path
   *
   * @param {string} path - D-Bus path
   * @param {string} iface - D-Bus interface name
   * @param {ChangesHandler} handler - callback function
   * @return {RemoveFn} function to unsubscribe from the changes
   */
  onObjectChanged(path, iface, handler) {
    const { remove } = this.client.subscribe(
      {
        path,
        interface: "org.freedesktop.DBus.Properties",
        member: "PropertiesChanged",
      },
      (_path, _iface, _signal, args) => {
        const [source_iface, changes, invalid] = args;
        if (iface === source_iface) {
          handler(changes, invalid);
        }
      },
    );
    return remove;
  }

  /**
   * Register a callback to run when some D-Bus signal is emitted
   *
   * @param {SignalMatcher} match - Object describing the signal
   * @param {SignalHandler} handler - callback function to handle the signal
   * @return {RemoveFn} function to unsubscribe
   */
  onSignal(match, handler) {
    const { remove } = this.client.subscribe(match, handler);
    return remove;
  }
}

export default DBusClient;
