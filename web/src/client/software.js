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

import { DBusClient } from "./dbus";
import { WithStatus, WithProgress } from "./mixins";

const SOFTWARE_SERVICE = "org.opensuse.DInstaller.Software";
const SOFTWARE_IFACE = "org.opensuse.DInstaller.Software1";
const SOFTWARE_PATH = "/org/opensuse/DInstaller/Software1";

/**
 * @typedef {object} Product
 * @property {string} id - Product ID (e.g., "Leap")
 * @property {string} name - Product name (e.g., "openSUSE Leap 15.4")
 * @property {string} description - Product description
 */

/**
 * Software client
 *
 * @ignore
 */
class SoftwareBaseClient {
  /**
   * @param {DBusClient} [dbusClient] - D-Bus client
   */
  constructor(dbusClient) {
    this.client = dbusClient || new DBusClient(SOFTWARE_SERVICE);
  }

  /**
   * Returns the list of available products
   *
   * @return {Promise<Array<Product>>}
   */
  async getProducts() {
    const proxy = await this.client.proxy(SOFTWARE_IFACE);
    return proxy.AvailableBaseProducts.map(product => {
      const [id, name, meta] = product;
      return { id, name, description: meta.description?.v };
    });
  }

  /**
   * Returns the selected product
   *
   * @return {Promise<Product|null>}
   */
  async getSelectedProduct() {
    const products = await this.getProducts();
    const proxy = await this.client.proxy(SOFTWARE_IFACE);
    if (proxy.SelectedBaseProduct === "") {
      return null;
    }
    return products.find(product => product.id === proxy.SelectedBaseProduct);
  }

  /**
   * Selects a product for installation
   *
   * @param {string} id - product ID
   */
  async selectProduct(id) {
    const proxy = await this.client.proxy(SOFTWARE_IFACE);
    return proxy.SelectProduct(id);
  }

  /**
   * Registers a callback to run when properties in the Software object change
   *
   * @param {(id: string) => void} handler - callback function
   */
  onProductChange(handler) {
    return this.client.onObjectChanged(SOFTWARE_PATH, SOFTWARE_IFACE, changes => {
      if ("SelectedBaseProduct" in changes) {
        const selected = changes.SelectedBaseProduct.v.toString();
        handler(selected);
      }
    });
  }
}

/**
 * Allows getting the list the available products and selecting one for installation.
 */
class SoftwareClient extends WithProgress(WithStatus(SoftwareBaseClient, SOFTWARE_PATH), SOFTWARE_PATH) {}

export { SoftwareClient };
