/*
 * Copyright (c) [2024] SUSE LLC
 *
 * All Rights Reserved.
 *
 * This program is free software; you can redistribute it and/or modify it
 * under the terms of the GNU General Public License as published by the Free
 * Software Foundation; either version 2 of the License, or (at your option)
 * any later version.
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

import { del, get, post, put } from "~/api/http";
import { APIAccessPoint, APIConnection, APIDevice, NetworkGeneralState } from "~/types/network";

/**
 * Returns the network configuration
 */
const fetchState = (): Promise<NetworkGeneralState> => get("/api/network/state");

/**
 * Returns a list of known devices
 */
const fetchDevices = (): Promise<APIDevice[]> => get("/api/network/devices");

/**
 * Returns data for given connection name
 */
const fetchConnection = (name: string): Promise<APIConnection> =>
  get(`/api/network/connections/${name}`);

/**
 * Returns the list of known connections
 */
const fetchConnections = (): Promise<APIConnection[]> => get("/api/network/connections");

/**
 * Returns the list of known access points
 */
const fetchAccessPoints = (): Promise<APIAccessPoint[]> => get("/api/network/wifi");

/**
 * Adds a new connection
 *
 * @param connection - connection to be added
 */
const addConnection = (connection: APIConnection) => post("/api/network/connections", connection);

/**
 * Updates given connection
 *
 * @param connection - connection to be updated
 */
const updateConnection = (connection: APIConnection) =>
  put(`/api/network/connections/${connection.id}`, connection);

/**
 * Deletes the connection matching given name
 */
const deleteConnection = (name: string) => del(`/api/network/connections/${name}`);

/**
 * Apply network changes
 */
const applyChanges = () => post("/api/network/system/apply");

/**
 * Performs the connect action for connection matching given name
 */
const connect = (name: string) => post(`/api/network/connections/${name}/connect`);

/**
 * Performs the disconnect action for connection matching given name
 */
const disconnect = (name: string) => post(`/api/network/connections/${name}/disconnect`);

/**
 * Make the connection persistent after the installation
 */
const persist = (name: string, value: boolean) =>
  post(`/api/network/connections/${name}/persist`, { value });

export {
  fetchState,
  fetchDevices,
  fetchConnection,
  fetchConnections,
  fetchAccessPoints,
  applyChanges,
  addConnection,
  updateConnection,
  deleteConnection,
  connect,
  disconnect,
  persist,
};
