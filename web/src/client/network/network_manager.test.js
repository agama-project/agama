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

import { mergeConnectionSettings, NetworkManagerAdapter } from "./network_manager";
import { createConnection } from "./model";
import { ConnectionState, ConnectionTypes } from "./index";
import { DBusClient } from "../dbus";
import cockpit from "../../lib/cockpit";

const NM_IFACE = "org.freedesktop.NetworkManager";
const NM_SETTINGS_IFACE = "org.freedesktop.NetworkManager.Settings";
const NM_ACTIVE_CONNECTION_IFACE = "org.freedesktop.NetworkManager.Connection.Active";
const NM_IP4CONFIG_IFACE = "org.freedesktop.NetworkManager.IP4Config";
const NM_CONNECTION_IFACE = "org.freedesktop.NetworkManager.Settings.Connection";

const dbusClient = new DBusClient("");

const activeConnections = {
  "/active/connection/wifi/1": {
    Id: "active-wifi-connection",
    Uuid: "uuid-wifi-1",
    State: ConnectionState.ACTIVATED,
    Type: ConnectionTypes.WIFI,
    Ip4Config: "/ip4Config/2"
  },
  "/active/connection/wired/1": {
    Id: "active-wired-connection",
    Uuid: "uuid-wired-1",
    State: ConnectionState.ACTIVATED,
    Type: ConnectionTypes.ETHERNET,
    Ip4Config: "/ip4Config/1"
  }
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

const AddAndActivateConnectionFn = jest.fn();
const networkProxy = () => ({
  wait: jest.fn(),
  ActivateConnection: jest.fn(),
  ActiveConnections: Object.keys(activeConnections),
  AddAndActivateConnection: AddAndActivateConnectionFn
});

const networkSettingsProxy = () => ({
  wait: jest.fn(),
  Hostname: "testing-machine",
  GetConnectionByUuid: () => "/org/freedesktop/NetworkManager/Settings/1"
});

const activeConnectionProxy = path => activeConnections[path];

const ipConfigProxy = path => addressesData[path];

const connectionSettingsMock = {
  wait: jest.fn(),
  GetSettings: () => ({
    connection: {
      id: cockpit.variant("s", "active-wifi-connection"),
      "interface-name": cockpit.variant("s", "wlp3s0"),
      uuid: cockpit.variant("s", "uuid-wifi-1"),
    },
    ipv4: {
      addresses: [],
      "address-data": cockpit.variant(
        "aa{sv}", [{
          address: cockpit.variant("s", "192.168.122.200"),
          prefix: cockpit.variant("u", 24)
        }]
      ),
      method: cockpit.variant("s", "auto"),
      gateway: cockpit.variant("s", "192.168.122.1"),
      dns: cockpit.variant("au", [67305985, 16843009]),
      "route-data": []
    }
  }),
  Update: jest.fn()
};

const connectionSettingsProxy = () => connectionSettingsMock;

describe("NetworkManagerAdapter", () => {
  beforeEach(() => {
    dbusClient.proxy = jest.fn().mockImplementation((iface, path) => {
      if (iface === NM_IFACE) return networkProxy();
      if (iface === NM_SETTINGS_IFACE) return networkSettingsProxy();
      if (iface === NM_ACTIVE_CONNECTION_IFACE) return activeConnectionProxy(path);
      if (iface === NM_IP4CONFIG_IFACE) return ipConfigProxy(path);
      if (iface === NM_CONNECTION_IFACE) return connectionSettingsProxy();
    });
  });

  describe("#activeConnections", () => {
    it("returns the list of active connections", async () => {
      const client = new NetworkManagerAdapter(dbusClient);
      const availableConnections = await client.activeConnections();

      expect(availableConnections.length).toEqual(2);
      const [wireless, ethernet] = availableConnections;
      expect(wireless).toEqual({
        name: "active-wifi-connection",
        id: "uuid-wifi-1",
        state: ConnectionState.ACTIVATED,
        type: ConnectionTypes.WIFI,
        addresses: [{ address: "10.0.0.2", prefix: 22 }]
      });

      expect(ethernet).toEqual({
        name: "active-wired-connection",
        id: "uuid-wired-1",
        state: ConnectionState.ACTIVATED,
        type: ConnectionTypes.ETHERNET,
        addresses: [{ address: "10.0.0.1", prefix: 22 }]
      });
    });
  });

  describe("#getConnection", () => {
    it("returns the connection with the given ID", async () => {
      const client = new NetworkManagerAdapter(dbusClient);
      const connection = await client.getConnection("uuid-wifi-1");
      expect(connection).toEqual({
        id: "uuid-wifi-1",
        name: "active-wifi-connection",
        ipv4: {
          addresses: [{ address: "192.168.122.200", prefix: 24 }],
          gateway: "192.168.122.1",
          method: "auto",
          nameServers: ["1.2.3.4", "1.1.1.1"]
        }
      });
    });
  });

  describe("#addConnection", () => {
    it("adds a connection", async () => {
      const client = new NetworkManagerAdapter(dbusClient);
      const connection = createConnection({ name: "Wired connection 1" });
      await client.addConnection(connection);
      expect(AddAndActivateConnectionFn).toHaveBeenCalledWith(
        expect.objectContaining({
          connection: expect.objectContaining({ id: cockpit.variant("s", connection.name) })
        })
      );
    });
  });

  describe("#updateConnection", () => {
    it("updates the connection", async () => {
      const client = new NetworkManagerAdapter(dbusClient);
      const connection = await client.getConnection("uuid-wifi-1");
      connection.ipv4 = {
        ...connection.ipv4,
        addresses: [{ address: "192.168.1.2", prefix: 24 }],
        gateway: "192.168.1.1",
        nameServers: ["1.2.3.4"]
      };
      client.activateConnection = jest.fn();

      await client.updateConnection(connection);
      expect(connectionSettingsMock.Update).toHaveBeenCalledWith(expect.objectContaining(
        {
          connection: expect.objectContaining({
            id: cockpit.variant("s", "active-wifi-connection")
          }),
          ipv4: expect.objectContaining({
            "address-data": cockpit.variant("aa{sv}", [
              { address: cockpit.variant("s", "192.168.1.2"), prefix: cockpit.variant("u", 24) }
            ]),
            gateway: cockpit.variant("s", "192.168.1.1")
          })
        }
      ));
      expect(client.activateConnection).toHaveBeenCalled();
    });
  });
});

describe("mergeConnectionSettings", () => {
  it("returns an object merging the original settings and the ones from the connection", () => {
    const settings = {
      uuid: cockpit.variant("s", "ba2b14db-fc6c-40a7-b275-77ef9341880c"),
      id: cockpit.variant("s", "Wired connection 1"),
      ipv4: {
        addresses: cockpit.variant("aau", [[3232266754, 24, 3232266753]]),
        "routes-data": cockpit.variant("aau", [])
      },
      proxy: {}

    };

    const connection = createConnection({
      name: "Wired connection 2",
      ipv4: {
        addresses: [{ address: "192.168.1.2", prefix: 24 }],
        gateway: "192.168.1.1"
      }
    });

    const newSettings = mergeConnectionSettings(settings, connection);

    expect(newSettings.connection.id).toEqual(cockpit.variant("s", connection.name));
    const expectedIpv4 = ({
      gateway: cockpit.variant("s", "192.168.1.1"),
      "address-data": cockpit.variant("aa{sv}", [{
        address: cockpit.variant("s", "192.168.1.2"),
        prefix: cockpit.variant("u", 24)
      }]),
      dns: cockpit.variant("au", []),
      method: cockpit.variant("s", "auto"),
      "routes-data": cockpit.variant("aau", [])
    });
    expect(newSettings.ipv4).toEqual(expect.objectContaining(expectedIpv4));
    expect(newSettings.proxy).not.toBeUndefined();
  });

  it("does not set a gateway if there are not addresses", () => {
    const connection = createConnection({ name: "Wired connection" });
    const settings = {};
    const newSettings = mergeConnectionSettings(settings, connection);
    expect(newSettings.gateway).toBeUndefined();
  });
});
