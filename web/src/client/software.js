/*
 * Copyright (c) [2022-2023] SUSE LLC
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
const PRODUCT_IFACE = "org.opensuse.Agama.Software1.Product";
const PRODUCT_PATH = "/org/opensuse/Agama/Software1/Product";
const REGISTRATION_IFACE = "org.opensuse.Agama1.Registration";

/**
 * @typedef {object} Product
 * @property {string} id - Product ID (e.g., "Leap")
 * @property {string} name - Product name (e.g., "openSUSE Leap 15.4")
 * @property {string} description - Product description
 */

/**
 * @typedef {object} Registration
 * @property {string} requirement - Registration requirement (i.e., "not-required", "optional",
 *  "mandatory").
 * @property {string|null} code - Registration code, if any.
 * @property {string|null} email - Registration email, if any.
 */

/**
 * @typedef {object} ActionResult
 * @property {boolean} success - Whether the action was successfully done.
 * @property {string} message - Result message.
 */

/**
 * Product manager.
 * @ignore
 */
class BaseProductManager {
  /**
   * @param {DBusClient} client
   */
  constructor(client) {
    this.client = client;
    this.proxies = {};
  }

  /**
   * Returns the list of available products.
   *
   * @return {Promise<Array<Product>>}
   */
  async getAll() {
    const proxy = await this.client.proxy(PRODUCT_IFACE);
    return proxy.AvailableProducts.map(product => {
      const [id, name, meta] = product;
      return { id, name, description: meta.description?.v };
    });
  }

  /**
   * Returns the selected product.
   *
   * @return {Promise<Product|null>}
   */
  async getSelected() {
    const products = await this.getAll();
    const proxy = await this.client.proxy(PRODUCT_IFACE);
    if (proxy.SelectedProduct === "") {
      return null;
    }
    return products.find(product => product.id === proxy.SelectedProduct);
  }

  /**
   * Selects a product for installation.
   *
   * @param {string} id - Product ID.
   */
  async select(id) {
    const proxy = await this.client.proxy(PRODUCT_IFACE);
    return proxy.SelectProduct(id);
  }

  /**
   * Registers a callback to run when properties in the Product object change.
   *
   * @param {(id: string) => void} handler - Callback function.
   */
  onChange(handler) {
    return this.client.onObjectChanged(PRODUCT_PATH, PRODUCT_IFACE, changes => {
      if ("SelectedProduct" in changes) {
        const selected = changes.SelectedProduct.v.toString();
        handler(selected);
      }
    });
  }

  /**
   * Returns the registration of the selected product.
   *
   * @return {Promise<Registration>}
   */
  async getRegistration() {
    const proxy = await this.client.proxy(REGISTRATION_IFACE, PRODUCT_PATH);
    const requirement = this.registrationRequirement(proxy.Requirement);
    const code = proxy.RegCode;
    const email = proxy.Email;

    const registration = { requirement, code, email };
    if (code.length === 0) registration.code = null;
    if (email.length === 0) registration.email = null;

    return registration;
  }

  /**
   * Tries to register the selected product.
   *
   * @param {string} code
   * @param {string} [email]
   * @returns {Promise<ActionResult>}
   */
  async register(code, email = "") {
    const proxy = await this.client.proxy(REGISTRATION_IFACE, PRODUCT_PATH);
    const result = await proxy.Register(code, { Email: { t: "s", v: email } });

    return {
      success: result[0] === 0,
      message: result[1]
    };
  }

  /**
   * Tries to deregister the selected product.
   *
   * @returns {Promise<ActionResult>}
   */
  async deregister() {
    const proxy = await this.client.proxy(REGISTRATION_IFACE, PRODUCT_PATH);
    const result = await proxy.Deregister();

    return {
      success: result[0] === 0,
      message: result[1]
    };
  }

  /**
   * Registers a callback to run when the registration changes.
   *
   * @param {(registration: Registration) => void} handler - Callback function.
   */
  onRegistrationChange(handler) {
    return this.client.onObjectChanged(PRODUCT_PATH, REGISTRATION_IFACE, () => {
      this.getRegistration().then(handler);
    });
  }

  /**
   * Helper method to generate the requirement representation.
   * @private
   *
   * @param {number} value - D-Bus registration value.
   * @returns {string}
   */
  registrationRequirement(value) {
    let requirement;

    switch (value) {
      case 0:
        requirement = "not-required";
        break;
      case 1:
        requirement = "optional";
        break;
      case 2:
        requirement = "mandatory";
        break;
    }

    return requirement;
  }
}

/**
 * Manages product selection.
 */
class ProductManager extends WithIssues(BaseProductManager, PRODUCT_PATH) { }

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
    this.product = new ProductManager(this.client);
    this.proxies = {};
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
}

/**
 * Manages software and product configuration.
 */
class SoftwareClient extends WithIssues(
  WithProgress(
    WithStatus(SoftwareBaseClient, SOFTWARE_PATH), SOFTWARE_PATH
  ), SOFTWARE_PATH
) { }

export { SoftwareClient };
