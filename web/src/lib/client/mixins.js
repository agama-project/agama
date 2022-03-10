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

  proxies() {
    return (this._proxies ||= {});
  },

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
  }
};

const applyMixin = (klass, ...fn) => Object.assign(klass.prototype, ...fn);

export { applyMixin, withDBus };
