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

import { NetworkClient, ConnectionTypes, ConnectionState } from "./network";

const active_conn = {
  id: "uuid-wired",
  name: "Wired connection 1",
  type: ConnectionTypes.ETHERNET,
  state: ConnectionState.ACTIVATED,
  addresses: [{ address: "192.168.122.1", prefix: 24 }]
};

const conn = {
  id: "uuid-wired",
  name: "Wired connection 1",
  type: ConnectionTypes.ETHERNET,
  addresses: [{ address: "192.168.122.1", prefix: 24 }]
};

const settings = {
  wifiScanSupported: true,
  hostname: "localhost.localdomain"
};

const adapter = {
  setUp: jest.fn(),
  activeConnections: jest.fn().mockReturnValue([active_conn]),
  connections: jest.fn().mockReturnValue([conn]),
  subscribe: jest.fn(),
  getConnection: jest.fn(),
  addConnection: jest.fn(),
  updateConnection: jest.fn(),
  deleteConnection: jest.fn(),
  accessPoints: jest.fn(),
  connectTo: jest.fn(),
  addAndConnectTo: jest.fn(),
  settings: jest.fn().mockReturnValue(settings),
};

describe("NetworkClient", () => {
  describe("#activeConnections", () => {
    it("returns the list of active connections from the adapter", () => {
      const client = new NetworkClient(adapter);
      const connections = client.activeConnections();
      expect(connections).toEqual([active_conn]);
    });
  });

  describe("#addresses", () => {
    it("returns the list of addresses", () => {
      const client = new NetworkClient(adapter);
      expect(client.addresses()).toEqual([{ address: "192.168.122.1", prefix: 24 }]);
    });
  });

  describe("#settings", () => {
    it("returns network general settings", () => {
      const client = new NetworkClient(adapter);
      expect(client.settings().hostname).toEqual("localhost.localdomain");
      expect(client.settings().wifiScanSupported).toEqual(true);
    });
  });
});
