/*
 * Copyright (c) [2022-2024] SUSE LLC
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

import { HTTPClient } from "./http";
import { NetworkClient } from "./network";
const ADDRESS = "http://localhost";


const mockWiredConnection = {
  "id": "eth0",
  "status": "up",
  "interface": "eth0",
  "method4": "manual",
  "method6": "manual",
  "addresses": ["192.168.122.100/24"],
  "nameservers": ["192.168.122.1"],
  "gateway4": "192.168.122.1"
}

const mockWirelessConnection = {
  "id": "AgamaNetwork",
  "method4": "auto",
  "method6": "auto",
  "wireless": {
    "passworkd": "agama.test",
    "security": "wpa-psk",
    "ssid": "Agama",
    "mode": "infrastructure"
  },
  "status": "down"
}

const mockConnection = {
  "id": "eth0",
  "status": "up",
  "interface": "eth0",
  "method4": "manual",
  "method6": "manual",
  "addresses": [{ address: "192.168.122.100", prefix: 24 }],
  "nameservers": ["192.168.122.1"],
  "gateway4": "192.168.122.1"
}

const mockSettings = {
  hostname: "localhost.localdomain",
  connectivity: true,
  wireless_enabled: true,
  networking_enabled: true
}

const mockJsonFn = jest.fn();

const mockGetFn = jest.fn().mockImplementation(() => {
  return {
    ok: true,
    json: mockJsonFn,
  };
});

jest.mock("./http", () => {
  return {
    HTTPClient: jest.fn().mockImplementation(() => {
      return {
        get: mockGetFn,
      };
    }),
  };
});

describe("NetworkClient", () => {
  describe("#connections", () => {
    it("returns the list of active connections from the adapter", async () => {
      const http = new HTTPClient(new URL(ADDRESS));
      const client = new NetworkClient(http);
      mockJsonFn.mockResolvedValue([mockWiredConnection, mockWirelessConnection]);
      const connections = await client.connections();
      const eth0 = connections.find(c => c.id === "eth0");
      expect(eth0).toEqual(mockConnection);
    });
  });

  describe("#addresses", () => {
    it("returns the list of addresses", async () => {
      const http = new HTTPClient(new URL(ADDRESS));
      const client = new NetworkClient(http);
      mockJsonFn.mockResolvedValue([mockWiredConnection, mockWirelessConnection]);
      const addresses = await client.addresses();
      expect(addresses).toEqual([{ address: "192.168.122.100", prefix: 24 }]);
    });
  });


  describe("#settings", () => {
    it("returns network general settings", async () => {
      const http = new HTTPClient(new URL(ADDRESS));
      const client = new NetworkClient(http);
      mockJsonFn.mockResolvedValue(mockSettings);
      const settings = await client.settings();
      expect(settings.hostname).toEqual("localhost.localdomain");
    });
  });
});
