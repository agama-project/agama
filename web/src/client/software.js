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
import { WithIssues, WithStatus, WithProgress } from "./mixins";

const SOFTWARE_SERVICE = "org.opensuse.Agama.Software1";
const SOFTWARE_IFACE = "org.opensuse.Agama.Software1";
const SOFTWARE_PATH = "/org/opensuse/Agama/Software1";

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
   * @param {string|undefined} address - D-Bus address; if it is undefined, it uses the system bus.
   */
  constructor(address = undefined) {
    this.client = new DBusClient(SOFTWARE_SERVICE, address);
  }

  /**
   * Asks the service to reload the repositories metadata
   *
   * @return {Promise<void>}
   */
  async probe() {
    const proxy = await this.client.proxy(SOFTWARE_IFACE);
    return proxy.Probe();
  }

  /**
   * Returns the list of available products
   *
   * @return {Promise<Array<Product>>}
   */
  async getProducts() {
    const proxy = await this.client.proxy(SOFTWARE_IFACE);
    return proxy.AvailableProducts.map(product => {
      const [id, name, meta] = product;
      return { id, name, description: meta.description?.v };
    });
  }

  /**
   * Returns how much space installation takes on disk
   *
   * @return {Promise<string>}
   */
  async getUsedSpace() {
    const proxy = await this.client.proxy(SOFTWARE_IFACE);
    return proxy.UsedDiskSpace();
  }

  /**
   * Returns available patterns
   *
   * @param {boolean} filter - `true` = filter the patterns, `false` = all patterns
   * @return {Promise<Array<string>>}
   */
  async patterns(filter) {
    const proxy = await this.client.proxy(SOFTWARE_IFACE);
    return proxy.ListPatterns(filter);
  }

  /**
   * @typedef {Object.<string, number>} PatternSelection mapping "name" =>
   * "who selected the pattern"
   */

  /**
   * Returns selected patterns
   *
   * @return {Promise<PatternSelection>}
   */
  async selectedPatterns() {
    const proxy = await this.client.proxy(SOFTWARE_IFACE);
    return proxy.SelectedPatterns;
  }

  /**
   * Select a pattern to install
   *
   * @param {string} name - name of the pattern
   * @return {Promise<void>}
   */
  async addPattern(name) {
    const proxy = await this.client.proxy(SOFTWARE_IFACE);
    return proxy.AddPattern(name);
  }

  /**
   * Deselect a pattern to install
   *
   * @param {string} name - name of the pattern
   * @return {Promise<void>}
   */
  async removePattern(name) {
    const proxy = await this.client.proxy(SOFTWARE_IFACE);
    return proxy.RemovePattern(name);
  }

  /**
   * Returns the selected product
   *
   * @return {Promise<Product|null>}
   */
  async getSelectedProduct() {
    const products = await this.getProducts();
    const proxy = await this.client.proxy(SOFTWARE_IFACE);
    if (proxy.SelectedProduct === "") {
      return null;
    }
    return products.find(product => product.id === proxy.SelectedProduct);
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
      if ("SelectedProduct" in changes) {
        const selected = changes.SelectedProduct.v.toString();
        handler(selected);
      }
    });
  }
}

/**
 * Allows getting the list the available products and selecting one for installation.
 */
class SoftwareClient extends WithIssues(
  WithProgress(
    WithStatus(SoftwareBaseClient, SOFTWARE_PATH), SOFTWARE_PATH
  ), SOFTWARE_PATH
) { }

export { SoftwareClient };
