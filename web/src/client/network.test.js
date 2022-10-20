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

import {
  CONNECTION_STATE, CONNECTION_TYPES, NetworkClient, formatIp, NetworkManagerAdapter
} from "./network";
import { DBusClient } from "./dbus";

const NM_IFACE = "org.freedesktop.NetworkManager";
const NM_SETTINGS_IFACE = "org.freedesktop.NetworkManager.Settings";
const NM_ACTIVE_CONNECTION_IFACE = "org.freedesktop.NetworkManager.Connection.Active";
const NM_CONNECTION_IFACE = "org.freedesktop.NetworkManager.Settings.Connection";
const NM_IP4CONFIG_IFACE = "org.freedesktop.NetworkManager.IP4Config";

const dbusClient = new DBusClient("");
const activeConnections = {
  "/active/connection/wifi/1": {
    Id: "active-wifi-connection",
    path: "/active/wifi/connection",
    Connection: "/active/connection/wifi/1",
    Devices: ["hardware/wifi/1"],
    State: CONNECTION_STATE.ACTIVATED,
    Type: CONNECTION_TYPES.WIFI,
    Ip4Config: "/ip4Config/2"
  },
  "/active/connection/wired/1": {
    Id: "active-wired-connection",
    path: "/active/wired/connection",
    Connection: "/active/connection/wired/1",
    Devices: ["hardware/wired/1"],
    State: CONNECTION_STATE.ACTIVATED,
    Type: CONNECTION_TYPES.ETHERNET,
    Ip4Config: "/ip4Config/1"
  }
};

const ipv4SettingsMock = {
  "address-data": {
    t: "aa{sv}",
    v: [
      {
        address: {
          t: "s",
          v: "192.168.68.254"
        },
        prefix: {
          t: "u",
          v: 24
        }
      }
    ]
  },
  addresses: {
    t: "aau",
    v: [
      [
        4265912512,
        24,
        21276864
      ]
    ]
  },
  dns: {
    t: "au",
    v: [67305985, 16843009]
  },
  "dns-search": {
    t: "as",
    v: []
  },
  gateway: {
    t: "s",
    v: "192.168.68.1"
  },
  method: {
    t: "s",
    v: "manual"
  },
  "route-data": {
    t: "aa{sv}",
    v: []
  },
  routes: {
    t: "aau",
    v: []
  }
};

const connectionSettingsMock = {
  Update: jest.fn(),
  GetSettings: () => ({ ipv4: ipv4SettingsMock }),
};

const networkProxy = {
  wait: jest.fn(),
  ActivateConnection: jest.fn(),
  ActiveConnections: Object.keys(activeConnections)
};

const networkSettingsProxy = {
  wait: jest.fn(),
  Hostname: "testing-machine"
};

const activeConnectionProxy = path => {
  return activeConnections[path];
};

// TODO: return a mock for each connection path
const connectionProxy = path => connectionSettingsMock;

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
    settings_path: "/active/connection/wifi/1",
    device_path: "hardware/wifi/1",
    state: CONNECTION_STATE.ACTIVATED,
    type: CONNECTION_TYPES.WIFI,
    ipv4: ipv4SettingsMock,
    addresses: [{ address: "10.0.0.2", prefix: "22" }]
  },
  {
    id: "active-wired-connection",
    path: "/active/connection/wired/1",
    settings_path: "/active/connection/wired/1",
    device_path: "hardware/wired/1",
    ipv4: ipv4SettingsMock,
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
      if (iface === NM_CONNECTION_IFACE) return connectionProxy(path);
      if (iface === NM_IP4CONFIG_IFACE) return ipConfigProxy(path);
    });
  });

  describe("#config", () => {
    it("returns an object containing the hostname, known IPv4 addresses, and active connections", async () => {
      const client = new NetworkClient(new NetworkManagerAdapter(dbusClient));
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
      const client = new NetworkClient(new NetworkManagerAdapter(dbusClient));
      const availableConnections = await client.activeConnections();

      expect(availableConnections).toEqual(expectedActiveConnections);
    });
  });

  describe("#susbcribe", () => {
    it.skip("register a listener for added connections", () => {
      // TODO
    });

    it.skip("register a listener for updated connections", () => {
      // TODO
    });

    it.skip("register a listener for removed connections", () => {
      // TODO
    });
  });

  describe("#updateConnection", () => {
    it("updates given connection", async () => {
      const client = new NetworkClient(new NetworkManagerAdapter(dbusClient));

      const updatedConnection = {
        id: "Updated Connection",
        path: "/active/connection/wifi/1",
        settings_path: "/active/connection/wifi/1",
        device_path: "/hardware/wifi/1",
        ipv4: { method: "manual", addresses: [{ address: "192.168.1.100", prefix: 24 }] },
        addresses: [],
        type: "manual",
        state: 2
      };

      await client.updateConnection(updatedConnection);
      expect(connectionSettingsMock.Update).toHaveBeenCalledWith(
        expect.objectContaining({
          ipv4: expect.objectContaining({
            method: expect.objectContaining({ v: "manual" })
          })
        })
      );
    });

    it("re-activates the connection", async () => {
      const client = new NetworkClient(new NetworkManagerAdapter(dbusClient));

      const updatedConnection = {
        id: "Updated Connection",
        path: "/active/connection/wifi/1",
        settings_path: "/active/connection/wifi/1",
        device_path: "/hardware/wifi/1",
        ipv4: { addresses: [] },
        addresses: [],
        type: "manual",
        state: 2
      };

      await client.updateConnection(updatedConnection);
      expect(networkProxy.ActivateConnection).toHaveBeenCalledWith(
        "/active/connection/wifi/1",
        "/hardware/wifi/1",
        "/"
      );
    });

    describe("when using DHCP", () => {
      let client;
      let updatedConnection;

      describe("without manual addresses", () => {
        beforeEach(() => {
          client = new NetworkClient(new NetworkManagerAdapter(dbusClient));
          updatedConnection = {
            id: "Updated Connection",
            path: "/active/connection/wifi/1",
            settings_path: "/active/connection/wifi/1",
            device_path: "/hardware/wifi/1",
            ipv4: { method: "auto", addresses: [], gateway: "192.168.1.1" },
            addresses: [],
            type: "manual",
            state: 2
          };
        });

        it("does not sent a gateway", async () => {
          await client.updateConnection(updatedConnection);
          expect(connectionSettingsMock.Update).toHaveBeenCalledWith(
            expect.objectContaining({
              ipv4: expect.not.objectContaining({
                gateway: expect.objectContaining({ v: "192.168.1.1" })
              })
            })
          );
        });
      });

      describe("with manual addresses", () => {
        beforeEach(() => {
          client = new NetworkClient(new NetworkManagerAdapter(dbusClient));
          updatedConnection = {
            id: "Updated Connection",
            path: "/active/connection/wifi/1",
            settings_path: "/active/connection/wifi/1",
            device_path: "/hardware/wifi/1",
            ipv4: { method: "auto", addresses: [{ address: "192.168.1.2", prefix: 24 }], gateway: "192.168.1.1" },
            addresses: [],
            type: "manual",
            state: 2
          };
        });

        it("sends the configured gateway", async () => {
          await client.updateConnection(updatedConnection);
          expect(connectionSettingsMock.Update).toHaveBeenCalledWith(
            expect.objectContaining({
              ipv4: expect.objectContaining({
                gateway: expect.objectContaining({ v: "192.168.1.1" })
              })
            })
          );
        });
      });
    });
  });
});
