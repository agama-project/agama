/*
 * Copyright (c) [2023] SUSE LLC
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
//
import DBusClient from "../dbus";
import { NetworkManagerAdapter } from "./network_manager";

const SERVICE_NAME = "org.opensuse.Agama1";

/**
 * @typedef {import("./index").NetworkEventFn} NetworkEventFn
 * @typedef {import("./model").Connection} Connection
 */

/**
 * NetworkClient adapter for Agama network service
 */
class AgamaNetworkAdapter {
  /**
   * @param {string} address - D-Bus address
   */
  constructor(address) {
    this.nm = new NetworkManagerAdapter();
    this.client = new DBusClient(SERVICE_NAME, address);
    this.proxies = {
      connections: {}
    };
    this.eventsHandler = null;
  }

  /**
   * Set up the client
   *
   * @param {NetworkEventFn} handler - Events handler
   */
  async setUp(handler) {
    if (this.setUpDone) return;

    return this.nm.setUp(handler);
  }

  /**
   * Returns the active connections
   *
   * @return {ActiveConnection[]}
   */
  activeConnections() {
    return this.nm.activeConnections();
  }

  /**
   * Returns the connection settings
   *
   * @return {Promise<Connection[]>}
   */
  connections() {
    return this.nm.connections();
  }

  /**
   * Returns the list of available wireless access points (AP)
   *
   * @return {AccessPoint[]}
   */
  accessPoints() {
    return this.nm.accessPoints();
  }

  /**
   * Connects to given Wireless network
   *
   * @param {Connection} connection - connection to be activated
   */
  async connectTo(connection) {
    return this.nm.connectTo(connection);
  }

  /**
   * Add the connection for the given Wireless network and activate it
   *
   * @param {string} ssid - Network id
   * @param {object} options - connection options
   */
  async addAndConnectTo(ssid, options) {
    return this.nm.addAndConnectTo(ssid, options);
  }

  /**
   * Adds a new connection
   *
   * @param {Connection} connection - Connection to add
   */
  async addConnection(connection) {
    return this.nm.addConnection(connection);
  }

  /**
   * Returns the connection with the given ID
   *
   * @param {string} id - Connection ID
   * @return {Promise<Connection>}
   */
  async getConnection(id) {
    return this.nm.getConnection(id);
  }

  /**
   * Updates the connection
   *
   * It uses the 'path' to match the connection in the backend.
   *
   * @param {Connection} connection - Connection to update
   */
  async updateConnection(connection) {
    return this.nm.updateConnection(connection);
  }

  /**
   * Deletes the connection
   *
   * It uses the 'path' to match the connection in the backend.
   *
   * @param {Connection} connection - Connection to delete
   */
  async deleteConnection(connection) {
    return this.nm.deleteConnection(connection);
  }

  /*
  * Returns network general settings
  */
  settings() {
    return this.nm.settings();
  }
}

export { AgamaNetworkAdapter };
