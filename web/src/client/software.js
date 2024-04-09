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
import { WithIssues, WithProgress, WithStatus } from "./mixins";

const SOFTWARE_SERVICE = "org.opensuse.Agama.Software1";
const PRODUCT_PATH = "/org/opensuse/Agama/Software1/Product";
const REGISTRATION_IFACE = "org.opensuse.Agama1.Registration";

/**
 * Enum for the reasons to select a pattern
 *
 * @readonly
 * @enum { number }
 */
const SelectedBy = Object.freeze({
  /** Selected by the user */
  USER: 0,
  /** Automatically selected as a dependency of another package */
  AUTO: 1,
  /** No selected */
  NONE: 2,
});

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
 * @typedef {object} SoftwareProposal
 * @property {string} size - Used space in human-readable form.
 * @property {Object.<string, number>} patterns - Selected patterns and the reason.
 */

/**
 * @typedef {object} SoftwareConfig
 * @propery {Object.<string, boolean>} patterns - An object where the keys are the pattern names
 *   and the values whether to install them or not.
 * @property {string|undefined} product - Product to install.
 */

/**
 * @typedef {Object} Pattern
 * @property {string} name - Pattern name (internal ID).
 * @property {string} category - Pattern category.
 * @property {string} summary - User visible pattern name.
 * @property {string} description - Long description of the pattern.
 * @property {number} order - Display order (string!).
 * @property {string} icon - Icon name (not path or file name!).
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
      message: result[1],
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
      message: result[1],
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
    let requirement = "unknown";

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
 * Software client
 *
 * @ignore
 */
class SoftwareBaseClient {
  /**
   * @param {string|undefined} address - D-Bus address; if it is undefined, it uses the system bus.
   */
  /**
   * @param {import("./http").HTTPClient} client - HTTP client.
   */
  constructor(client) {
    this.client = client;
  }

  /**
   * Asks the service to reload the repositories metadata
   *
   * @return {Promise<Response>}
   */
  probe() {
    return this.client.post("/software/probe", {});
  }

  /**
   * Returns how much space installation takes on disk
   *
   * @return {Promise<SoftwareProposal>}
   */
  async getProposal() {
    const response = await this.client.get("/software/proposal");
    if (!response.ok) {
      console.log("Failed to get software proposal: ", response);
    }

    return response.json();
  }

  /**
   * Returns available patterns
   *
   * @return {Promise<Pattern[]>}
   */
  async getPatterns() {
    const response = await this.client.get("/software/patterns");
    if (!response.ok) {
      console.log("Failed to get software patterns: ", response);
      return [];
    }
    /** @type Array<{ name: string, category: string, summary: string, description: string, order: string, icon: string }> */
    const patterns = await response.json();
    return patterns.map((pattern) => ({
      name: pattern.name,
      category: pattern.category,
      summary: pattern.summary,
      description: pattern.description,
      order: parseInt(pattern.order),
      icon: pattern.icon,
    }));
  }

  /**
   * @return {Promise<SoftwareConfig>}
   */
  config() {
    return this.client.get("/software/config");
  }

  /**
   * @param {Object.<string, boolean>} patterns - An object where the keys are the pattern names
   *   and the values whether to install them or not.
   * @return {Promise<Response>}
   */
  selectPatterns(patterns) {
    return this.client.put("/software/config", { patterns });
  }

  /**
   * Registers a callback to run when the select product changes.
   *
   * @param {(changes: object) => void} handler - Callback function.
   * @return {import ("./http").RemoveFn} Function to remove the callback.
   */
  onSelectedPatternsChanged(handler) {
    return this.client.onEvent("SoftwareProposalChanged", ({ patterns }) => {
      handler(patterns);
    });
  }
}

/**
 * Manages software and product configuration.
 */
class SoftwareClient extends WithIssues(
  WithProgress(
    WithStatus(SoftwareBaseClient, "/software/status", SOFTWARE_SERVICE),
    "/software/progress",
    SOFTWARE_SERVICE,
  ),
  "/software/issues/software",
  "/org/opensuse/Agama/Software1",
) {}

class ProductBaseClient {
  /**
   * @param {import("./http").HTTPClient} client - HTTP client.
   */
  constructor(client) {
    this.client = client;
  }

  /**
   * Returns the list of available products.
   *
   * @return {Promise<Array<Product>>}
   */
  async getAll() {
    const response = await this.client.get("/software/products");
    if (!response.ok) {
      console.log("Failed to get software products: ", response);
    }
    return response.json();
  }

  /**
   * Returns the identifier of the selected product.
   *
   * @return {Promise<string>} Selected identifier.
   */
  async getSelected() {
    const response = await this.client.get("/software/config");
    if (!response.ok) {
      console.log("Failed to get software config: ", response);
    }
    const config = await response.json();
    return config.product;
  }

  /**
   * Selects a product for installation.
   *
   * @param {string} id - Product ID.
   */
  async select(id) {
    await this.client.put("/software/config", { product: id });
  }

  /**
   * Registers a callback to run when the select product changes.
   *
   * @param {(id: string) => void} handler - Callback function.
   * @return {import ("./http").RemoveFn} Function to remove the callback.
   */
  onChange(handler) {
    return this.client.onEvent("ProductChanged", ({ id }) => {
      if (id) {
        handler(id);
      }
    });
  }
}

class ProductClient
  extends WithIssues(ProductBaseClient, "/software/issues/product", PRODUCT_PATH) {}

export { ProductClient, SelectedBy, SoftwareClient };
