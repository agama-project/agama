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

import { securityFromFlags, mergeConnectionSettings, NetworkManagerAdapter } from "./network_manager";
import { createConnection } from "./model";
import { ConnectionState, ConnectionTypes } from "./index";
import DBusClient from "../dbus";
import cockpit from "../../lib/cockpit";

jest.mock("../dbus");

const NM_IFACE = "org.freedesktop.NetworkManager";
const NM_SETTINGS_IFACE = "org.freedesktop.NetworkManager.Settings";
const IP4CONFIG_IFACE = "org.freedesktop.NetworkManager.IP4Config";
const DEVICE_IFACE = "org.freedesktop.NetworkManager.Device";
const NM_CONNECTION_IFACE = "org.freedesktop.NetworkManager.Settings.Connection";
const ACTIVE_CONNECTION_IFACE = "org.freedesktop.NetworkManager.Connection.Active";
const ACCESS_POINT_IFACE = "org.freedesktop.NetworkManager.AccessPoint";

let devices;
const defaultDevices = {
  "/org/freedesktop/NetworkManager/Devices/17": {
    ActiveConnection: "/",
    NmPluginMissing: false,
    Real: true,
    InterfaceFlags: 1,
    DeviceType: 2,
    Mtu: 1500,
    Ports: [],
    IpInterface: "",
    DriverVersion: "6.0.12-1-default",
    State: 30,
    Ip6Config: "/org/freedesktop/NetworkManager/IP6Config/17",
    Metered: 0,
    Ip4Address: 0,
    LldpNeighbors: [],
    Interface: "wlp0s20u5",
    FirmwareMissing: false,
    Ip6Connectivity: 1,
    Driver: "mt7601u",
    PhysicalPortId: "",
    Capabilities: 1,
    Dhcp4Config: "/",
    AvailableConnections: [
      "/org/freedesktop/NetworkManager/Settings/3",
      "/org/freedesktop/NetworkManager/Settings/4",
      "/org/freedesktop/NetworkManager/Settings/5"
    ],
    HwAddress: "BA:FB:BE:AB:00:5B",
    Managed: true,
    StateReason: [
      30,
      42
    ],
    FirmwareVersion: "N/A",
    Ip4Config: "/org/freedesktop/NetworkManager/IP4Config/17",
    Udi: "/sys/devices/pci0000:00/0000:00:14.0/usb2/2-5/2-5:1.0/net/wlp0s20u5",
    Autoconnect: true,
    Ip4Connectivity: 1,
    Path: "pci-0000:00:14.0-usb-0:5:1.0",
    Dhcp6Config: "/"
  }
};

const accessPoints = {
  "/org/freedesktop/NetworkManager/AccessPoint/11": {
    Flags: 3,
    WpaFlags: 0,
    RsnFlags: 392,
    Ssid: "VGVzdGluZw==",
    Frequency: 2432,
    HwAddress: "00:31:92:25:84:FA",
    Mode: 2,
    MaxBitrate: 270000,
    Strength: 76,
    LastSeen: 96711
  }
};

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
  },
};

const connections = {
  "/org/freedesktop/NetworkManager/Settings/1": {
    wait: jest.fn(),
    path: "/org/freedesktop/NetworkManager/Settings/1",
    GetSettings: () => ({
      connection: {
        id: cockpit.variant("s", "Testing"),
        uuid: cockpit.variant("s", "1f40ddb0-e6e8-4af8-8b7a-0b3898f0f57a"),
        type: cockpit.variant("s", "802-11-wireless")
      },
      ipv4: {
        addresses: [],
        "address-data": cockpit.variant("aa{sv}", []),
        method: cockpit.variant("s", "auto"),
        dns: [],
        "dns-data": cockpit.variant("as", []),
        "route-data": []
      },
      "802-11-wireless": {
        ssid: cockpit.variant("ay", cockpit.byte_array("Testing")),
        hidden: cockpit.variant("b", true),
        mode: cockpit.variant("s", "infrastructure")
      },
      "802-11-wireless-security": {
        "key-mgmt": cockpit.variant("s", "wpa-psk")
      }
    })
  }
};

// Reminder: by default, properties added using Object.defineProperties() are not enumerable.
// We use #defineProperties here, so it doesn't show up as a "connection" in these objects.
// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/defineProperties#enumerable
Object.defineProperties(activeConnections, {
  addEventListener: { value: jest.fn() }
});

Object.defineProperties(connections, {
  addEventListener: { value: jest.fn() }
});

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

const ActivateConnectionFn = jest.fn();

const AddConnectionFn = jest.fn();
let networkProxy;
const networkSettingsProxy = {
  wait: jest.fn(),
  Hostname: "testing-machine",
  GetConnectionByUuid: () => "/org/freedesktop/NetworkManager/Settings/1",
  AddConnection: AddConnectionFn,
  addEventListener: () => ({ value: jest.fn(), enumerable: false })
};

const connectionSettingsMock = {
  wait: jest.fn(),
  path: "/org/freedesktop/NetworkManager/Settings/1",
  GetSettings: () => ({
    connection: {
      id: cockpit.variant("s", "active-wifi-connection"),
      "interface-name": cockpit.variant("s", "wlp3s0"),
      uuid: cockpit.variant("s", "uuid-wifi-1"),
      type: cockpit.variant("s", "802-11-wireless")
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
      // this field is buggy and superseded by dns-data. test that it is not used.
      dns: cockpit.variant("au", [67305985]),
      "dns-data": cockpit.variant("as", ["192.168.122.1", "1.1.1.1"]),
      "route-data": []
    }
  }),
  Update: jest.fn(),
  Delete: jest.fn()
};

const connectionSettingsProxy = () => connectionSettingsMock;

describe("NetworkManagerAdapter", () => {
  beforeEach(() => {
    networkProxy = {
      wait: jest.fn(),
      ActivateConnection: ActivateConnectionFn,
      ActiveConnections: Object.keys(activeConnections),
      WirelessEnabled: true,
      WirelessHardwareEnabled: true,
      addEventListener: jest.fn()
    };

    devices = defaultDevices;

    DBusClient.mockImplementation(() => {
      return {
        proxy: (iface) => {
          if (iface === NM_IFACE) return networkProxy;
          if (iface === NM_SETTINGS_IFACE) return networkSettingsProxy;
          if (iface === NM_CONNECTION_IFACE) return connectionSettingsProxy();
        },
        proxies: (iface) => {
          if (iface === ACCESS_POINT_IFACE) return accessPoints;
          if (iface === ACTIVE_CONNECTION_IFACE) return activeConnections;
          if (iface === DEVICE_IFACE) return devices;
          if (iface === NM_CONNECTION_IFACE) return connections;
          if (iface === IP4CONFIG_IFACE) return addressesData;
          return {};
        }
      };
    });
  });

  describe("#accessPoints", () => {
    it("returns the list of last scanned access points", async () => {
      const client = new NetworkManagerAdapter();
      await client.setUp();
      const accessPoints = client.accessPoints();

      expect(accessPoints.length).toEqual(1);
      const [testing] = accessPoints;
      expect(testing).toEqual({
        ssid: "Testing",
        hwAddress: "00:31:92:25:84:FA",
        strength: 76,
        security: ["WPA2"]
      });
    });
  });

  describe("#activeConnections", () => {
    it("returns the list of active connections", async () => {
      const client = new NetworkManagerAdapter();
      await client.setUp();
      const availableConnections = client.activeConnections();

      expect(availableConnections.length).toEqual(2);
      const [wireless, ethernet] = availableConnections;
      expect(wireless).toEqual({
        id: "active-wifi-connection",
        uuid: "uuid-wifi-1",
        state: ConnectionState.ACTIVATED,
        type: ConnectionTypes.WIFI,
        addresses: [{ address: "10.0.0.2", prefix: 22 }]
      });

      expect(ethernet).toEqual({
        id: "active-wired-connection",
        uuid: "uuid-wired-1",
        state: ConnectionState.ACTIVATED,
        type: ConnectionTypes.ETHERNET,
        addresses: [{ address: "10.0.0.1", prefix: 22 }]
      });
    });
  });

  describe("#connections", () => {
    it("returns the list of settings (profiles)", async () => {
      const client = new NetworkManagerAdapter();
      await client.setUp();
      const connections = await client.connections();

      const [wifi] = connections;

      expect(wifi).toEqual({
        id: "Testing",
        uuid: "1f40ddb0-e6e8-4af8-8b7a-0b3898f0f57a",
        path: "/org/freedesktop/NetworkManager/Settings/1",
        type: ConnectionTypes.WIFI,
        ipv4: { method: 'auto', addresses: [], nameServers: [] },
        wireless: { ssid: "Testing", hidden: true },
      });
    });
  });

  describe("#connectTo", () => {
    it("activates the given connection", async () => {
      const client = new NetworkManagerAdapter();
      await client.setUp();
      const [wifi] = await client.connections();
      await client.connectTo(wifi);
      expect(ActivateConnectionFn).toHaveBeenCalledWith(wifi.path, "/", "/");
    });
  });

  describe("#availableWifiDevices", () => {
    it("returns the list of WiFi devices", async () => {
      const client = new NetworkManagerAdapter();
      await client.setUp();

      expect(client.availableWifiDevices().length).toEqual(1);
      expect(client.availableWifiDevices()[0].Interface).toEqual("wlp0s20u5");
    });
  });

  describe("#wifiScanSupported", () => {
    describe("when wireless devices are disabled by software", () => {
      it("returns false", async () => {
        const client = new NetworkManagerAdapter();
        networkProxy.WirelessEnabled = false;
        await client.setUp();
        expect(client.wifiScanSupported()).toEqual(false);
      });
    });

    describe("when wireless devices are disabled by hardware", () => {
      it("returns false", async () => {
        const client = new NetworkManagerAdapter();
        networkProxy.WirelessHardwareEnabled = false;
        await client.setUp();
        expect(client.wifiScanSupported()).toEqual(false);
      });
    });

    describe("when wireless devices are enabled", () => {
      describe("but there are no WiFi devices", () => {
        it("returns false", async () => {
          const client = new NetworkManagerAdapter();
          devices = {};
          await client.setUp();
          expect(client.wifiScanSupported()).toEqual(false);
        });
      });

      describe("and at least a WiFi devices is present in the system", () => {
        it("returns true", async () => {
          const client = new NetworkManagerAdapter();
          await client.setUp();
          expect(client.wifiScanSupported()).toEqual(true);
        });
      });
    });
  });

  describe("#settings", () => {
    it("returns the Network Manager settings", async () => {
      const client = new NetworkManagerAdapter();
      await client.setUp();
      expect(client.settings().hostname).toEqual("testing-machine");
      expect(client.settings().wifiScanSupported).toEqual(true);
    });
  });
});

describe("securityFromFlags", () => {
  it("returns an array with the security protocols supported by the given AP flags", () => {
    expect(securityFromFlags(1, 0, 0)).toEqual(["WEP"]);
    expect(securityFromFlags(1, 0x00000100, 0x00000100)).toEqual(["WPA1", "WPA2"]);
    expect(securityFromFlags(1, 0x00000200, 0x00000200)).toEqual(["WPA1", "WPA2", "802.1X"]);
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
      "dns-data": cockpit.variant("as", []),
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
