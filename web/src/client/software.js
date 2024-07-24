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

import { WithProgress, WithStatus } from "./mixins";

const SOFTWARE_SERVICE = "org.opensuse.Agama.Software1";

/**
 * @typedef {object} Product
 * @property {string} id - Product ID (e.g., "Leap")
 * @property {string} name - Product name (e.g., "openSUSE Leap 15.4")
 * @property {string} description - Product description
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
}

/**
 * Manages software and product configuration.
 */
class SoftwareClient extends WithProgress(
  WithStatus(SoftwareBaseClient, "/software/status", SOFTWARE_SERVICE),
  "/software/progress",
  SOFTWARE_SERVICE,
) {}

class ProductClient {
  /**
   * @param {import("./http").HTTPClient} client - HTTP client.
   */
  constructor(client) {
    this.client = client;
  }
}

export { ProductClient, SoftwareClient };
