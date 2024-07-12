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

import DBusClient from "./dbus";

const NAME_OWNER_CHANGED = {
  interface: "org.freedesktop.DBus",
  member: "NameOwnerChanged",
};

/**
 * Monitor a D-Bus service
 */
class Monitor {
  /**
   * @param {string|undefined} address - D-Bus address; if it is undefined, it uses the system bus.
   * @param {string} serviceName - name of the service to monitor
   */
  constructor(address, serviceName) {
    this.serviceName = serviceName;
    this.client = new DBusClient("org.freedesktop.DBus", address);
  }

  /**
   * Registers a callback to be executed when the D-Bus service connection changes
   *
   * @param {() => void} handler - function to execute when the client gets
   *   disconnected.
   * @return {() => void} function to deregister the callbacks.
   */
  onDisconnect(handler) {
    return this.client.onSignal(NAME_OWNER_CHANGED, (_path, _interface, _signal, args) => {
      const [service, , newOwner] = args;
      if (service === this.serviceName && newOwner === "") {
        handler();
      }
    });
  }
}

export { Monitor };
