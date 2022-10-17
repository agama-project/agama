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

import { CONNECTION_STATE, CONNECTION_TYPES, NetworkClient, formatIp } from "./network";
import { DBusClient } from "./dbus";

const NM_IFACE = "org.freedesktop.NetworkManager";
const NM_SETTINGS_IFACE = "org.freedesktop.NetworkManager.Settings";
const NM_ACTIVE_CONNECTION_IFACE = "org.freedesktop.NetworkManager.Connection.Active";
const NM_IP4CONFIG_IFACE = "org.freedesktop.NetworkManager.IP4Config";

const dbusClient = new DBusClient("");
const activeConnections = {
  "/active/connection/wifi/1": {
    Id: "active-wifi-connection",
    path: "/active/wifi/connnection",
    State: CONNECTION_STATE.ACTIVATED,
    Type: CONNECTION_TYPES.WIFI,
    Ip4Config: "/ip4Config/2"
  },
  "/active/connection/wired/1": {
    Id: "active-wired-connection",
    path: "/active/wired/connnection",
    State: CONNECTION_STATE.ACTIVATED,
    Type: CONNECTION_TYPES.ETHERNET,
    Ip4Config: "/ip4Config/1"
  }
};

const networkProxy = {
  wait: jest.fn(),
  ActiveConnections: Object.keys(activeConnections)
};

const networkSettingsProxy = {
  wait: jest.fn(),
  Hostname: "testing-machine"
};

const activeConnectionProxy = path => {
  return activeConnections[path];
};

const addressesData = {
  "/ip4Config/1": {
    wait: jest.fn(),
    AddressData: [
      {
        address: { v: "10.0.0.1", t: "s" },
        prefix: { v: "22", t: "s" }
      }
    ]
  },
  "/ip4Config/2": {
    wait: jest.fn(),
    AddressData: [
      {
        address: { v: "10.0.0.2", t: "s" },
        prefix: { v: "22", t: "s" }
      }
    ]
  }
};

const ipConfigProxy = path => {
  return addressesData[path];
};

describe("#formatIp", () => {
  it("returns given IP address in the X.X.X.X/YY format", () => {
    const ipAddress = { address: "10.0.0.1", prefix: "22" };
    expect(formatIp(ipAddress)).toBe("10.0.0.1/22");
  });
});

const expectedActiveConnections = [
  {
    id: "active-wifi-connection",
    path: "/active/connection/wifi/1",
    state: CONNECTION_STATE.ACTIVATED,
    type: CONNECTION_TYPES.WIFI,
    addresses: [{ address: "10.0.0.2", prefix: "22" }]
  },
  {
    id: "active-wired-connection",
    path: "/active/connection/wired/1",
    state: CONNECTION_STATE.ACTIVATED,
    type: CONNECTION_TYPES.ETHERNET,
    addresses: [{ address: "10.0.0.1", prefix: "22" }]
  }
];

describe("NetworkClient", () => {
  beforeEach(() => {
    dbusClient.proxy = jest.fn().mockImplementation((iface, path) => {
      if (iface === NM_IFACE) return networkProxy;
      if (iface === NM_SETTINGS_IFACE) return networkSettingsProxy;
      if (iface === NM_ACTIVE_CONNECTION_IFACE) return activeConnectionProxy(path);
      if (iface === NM_IP4CONFIG_IFACE) return ipConfigProxy(path);
    });
  });

  describe("#config", () => {
    it("returns an object containing the hostname, known IPv4 addresses, and active connections", async () => {
      const client = new NetworkClient(dbusClient);
      const config = await client.config();

      expect(config.hostname).toEqual(networkSettingsProxy.Hostname);
      expect(config.addresses).toEqual([
        { address: "10.0.0.2", prefix: "22" },
        { address: "10.0.0.1", prefix: "22" }
      ]);
      expect(config.connections).toEqual(expectedActiveConnections);
    });
  });

  describe("#activeConnections", () => {
    it("returns thel list of active connections", async () => {
      const client = new NetworkClient(dbusClient);
      const availableConnections = await client.activeConnections();

      expect(availableConnections).toEqual(expectedActiveConnections);
    });
  });
});
