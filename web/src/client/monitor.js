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

import { applyMixin, withDBus } from "./mixins";
import cockpit from "../lib/cockpit";

const DBUS_SERVICE = "org.freedesktop.DBus";
const MATCHER = { interface: DBUS_SERVICE, member: "NameOwnerChanged" };

/**
 * Monitor a D-Bus service
 */
class Monitor {
  /**
   * @param {object} dbusClient - from cockpit.dbus
   * @param {string} serviceName - service to monitor
   */
  constructor(serviceName) {
    this.serviceName = serviceName;
    this._client = cockpit.dbus("org.freedesktop.DBus", {
      bus: "system",
      superuser: "try"
    });
  }

  /**
   * Registers a callback to be executed when the D-Bus service connection changes
   *
   * @param {function} handler - function to execute. It receives true if the service was connected
   *  and false if the service was disconnected.
   */
  onConnectionChange(handler) {
    return this.onSignal(MATCHER, (_path, _interface, _signal, args) => {
      const [service, , newOwner] = args;
      if (service === this.serviceName) {
        const connected = newOwner.length !== 0;
        handler(connected);
      }
    });
  }
}

applyMixin(Monitor, withDBus);
export default Monitor;
