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

const SOFTWARE_IFACE = "org.opensuse.DInstaller.Software1";

/**
 * Software client
 */
class SoftwareClient {
  constructor(dbusClient) {
    this._client = dbusClient;
  }

  /**
   * Return the list of available products
   *
   * @return {Promise.<Array>}
   */
  async getProducts() {
    const proxy = await this.proxy(SOFTWARE_IFACE);
    return proxy.AvailableBaseProducts.map(product => {
      const [id, name] = product;
      return { id, name };
    });
  }

  async getSelectedProduct() {
    const proxy = await this.proxy(SOFTWARE_IFACE);
    return proxy.SelectedBaseProduct;
  }

  async selectProduct(id) {
    const proxy = await this.proxy(SOFTWARE_IFACE);
    return proxy.SelectProduct(id);
  }
}

applyMixin(SoftwareClient, withDBus);
export default SoftwareClient;
