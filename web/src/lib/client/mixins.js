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

const withDBus = {
  /**
   * Registers a proxy for given iface
   *
   * @param {string} iface - D-Bus iface
   * @return {Object} a cockpit DBusProxy
   */
  async proxy(iface) {
    const _proxies = this.proxies();

    if (_proxies[iface]) {
      return _proxies[iface];
    }

    const proxy = this._client.proxy(iface, undefined, { watch: true });
    await proxy.wait();
    _proxies[iface] = proxy;
    return proxy;
  },

  /**
   * Returns known proxies
   *
   * @return {Object.<string, Object>} a collection of cockpit DBusProxy indexed by their D-Bus iface
   */
  proxies() {
    return (this._proxies ||= {});
  },

  /**
   * Register a callback to run when properties change for given D-Bus path
   *
   * @param {string} path - D-Bus path
   * @param {function} handler - callback function
   */
  onObjectChanged(path, handler) {
    const { remove } = this._client.subscribe(
      {
        path,
        interface: "org.freedesktop.DBus.Properties",
        member: "PropertiesChanged"
      },
      (_path, _iface, _signal, args) => {
        const [, changes, invalid] = args;
        handler(changes, invalid);
      }
    );
    return remove;
  },

  /**
   * Register a callback to run when some D-Bus signal is emitted
   *
   * @param {function} handler - callback function
   */
  onSignal(signal, handler) {
    const { remove } = this._client.subscribe(
      { interface: "org.opensuse.DInstaller", member: signal },
      handler
    );
    return remove;
  }
};

/**
 * Utility method for applying mixins to given object
 *
 * @param {Object} klass - target object
 * @param {...function} fn - function(s) to be copied to given object prototype
 */
const applyMixin = (klass, ...fn) => Object.assign(klass.prototype, ...fn);

export { applyMixin, withDBus };
