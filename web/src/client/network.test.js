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

const conn = {
  id: "uuid-wired",
  name: "Wired connection 1",
  type: ConnectionTypes.ETHERNET,
  state: ConnectionState.ACTIVATED,
  addresses: [{ address: "192.168.122.1", prefix: 24 }]
};

const adapter = {
  setUp: jest.fn(),
  activeConnections: jest.fn().mockReturnValue([conn]),
  hostname: jest.fn().mockReturnValue("localhost.localdomain"),
  subscribe: jest.fn(),
  getConnection: jest.fn(),
  addConnection: jest.fn(),
  updateConnection: jest.fn(),
  accessPoints: jest.fn()
};

describe("NetworkClient", () => {
  describe("#activeConnections", () => {
    it("retuns the list of active connections from the adapter", () => {
      const client = new NetworkClient(adapter);
      const connections = client.activeConnections();
      expect(connections).toEqual([conn]);
    });
  });

  describe("#addresses", () => {
    it("returns the list of addresses", () => {
      const client = new NetworkClient(adapter);
      expect(client.addresses()).toEqual([{ address: "192.168.122.1", prefix: 24 }]);
    });
  });

  describe("#hostname", () => {
    it("returns the hostname from the adapter", () => {
      const client = new NetworkClient(adapter);
      expect(client.hostname()).toEqual("localhost.localdomain");
    });
  });
});
