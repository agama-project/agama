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

const NM_IFACE = "org.freedesktop.NetworkManager";

export default class NetworkClient {
  constructor(dbusClient) {
    this._client = dbusClient;
  }

  async config() {
    return {
      addresses: await this.addresses(),
      hostname: await this.hostname()
    };
  }

  /**
   * Return the computer's hostname
   *
   * @return {Promise.<Object>}
   */
  async hostname() {
    const proxy = await this.proxy(NM_IFACE + ".Settings");

    return proxy.Hostname;
  }

  async addresses() {
    const proxy = this._client.proxy(
      "org.freedesktop.NetworkManager.IP4Config",
      "/org/freedesktop/NetworkManager/IP4Config/1"
    );

    await proxy.wait();

    return proxy.AddressData;
  }
}

applyMixin(NetworkClient, withDBus);
