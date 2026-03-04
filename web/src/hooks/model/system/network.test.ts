/*
 * Copyright (c) [2026] SUSE LLC
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

import { NetworkStatus, getIpAddresses, getNetworkStatus } from "~/hooks/model/system/network";
import {
  Connection,
  ConnectionMethod,
  ConnectionState,
  ConnectionType,
  Device,
  DeviceState,
} from "~/model/network/types";

const createConnection = (
  id: string,
  overrides: Partial<ConstructorParameters<typeof Connection>[1]> = {},
): Connection => {
  return new Connection(id, {
    method4: ConnectionMethod.AUTO,
    method6: ConnectionMethod.AUTO,
    state: ConnectionState.activated,
    persistent: true,
    ...overrides,
  });
};

const createDevice = (overrides: Partial<Device> = {}): Device => ({
  name: "eth0",
  type: ConnectionType.ETHERNET,
  state: DeviceState.CONNECTED,
  addresses: [{ address: "192.168.1.100", prefix: 24 }],
  nameservers: [],
  gateway4: "192.168.1.1",
  gateway6: "",
  method4: ConnectionMethod.AUTO,
  method6: ConnectionMethod.AUTO,
  macAddress: "AA:11:22:33:44:55",
  ...overrides,
});

describe("getNetworkStatus", () => {
  it("returns NOT_CONFIGURED status when no connections are given", () => {
    const result = getNetworkStatus([]);

    expect(result.status).toBe(NetworkStatus.NOT_CONFIGURED);
    expect(result.connections).toEqual([]);
    expect(result.persistentConnections).toEqual([]);
  });

  it("returns all given connections", () => {
    const persistentConnection = createConnection("Network 1");
    const nonPersistentConnection = createConnection("Network 2", {
      method4: ConnectionMethod.MANUAL,
      method6: ConnectionMethod.MANUAL,
      state: ConnectionState.activating,
      persistent: false,
    });

    const result = getNetworkStatus([persistentConnection, nonPersistentConnection]);

    expect(result.connections).toEqual([persistentConnection, nonPersistentConnection]);
  });

  it("returns given persistent connections", () => {
    const persistentConnection = createConnection("Network 1");
    const nonPersistentConnection = createConnection("Network 2", {
      method4: ConnectionMethod.MANUAL,
      method6: ConnectionMethod.MANUAL,
      state: ConnectionState.activating,
      persistent: false,
    });

    const result = getNetworkStatus([persistentConnection, nonPersistentConnection]);

    expect(result.persistentConnections).toEqual([persistentConnection]);
  });

  it("returns NO_PERSISTENT status when there are no persistent connections and includeNonPersistent is false", () => {
    const nonPersistentConnection = createConnection("Network 1", {
      method4: ConnectionMethod.MANUAL,
      method6: ConnectionMethod.MANUAL,
      state: ConnectionState.activating,
      persistent: false,
    });

    const result = getNetworkStatus([nonPersistentConnection], { includeNonPersistent: false });

    expect(result.status).toBe(NetworkStatus.NO_PERSISTENT);
  });

  it("checks against non-persistent connections too when includeNonPersistent is true", () => {
    const persistentConnection = createConnection("Network 1");
    const nonPersistentConnection = createConnection("Network 2", {
      method4: ConnectionMethod.MANUAL,
      method6: ConnectionMethod.MANUAL,
      state: ConnectionState.activating,
      persistent: false,
    });

    const result = getNetworkStatus([persistentConnection, nonPersistentConnection], {
      includeNonPersistent: true,
    });

    expect(result.status).toBe(NetworkStatus.MIXED);
  });

  it("returns AUTO status when there are only connections with auto method and without static IP addresses", () => {
    const autoConnection = createConnection("Network 1", {
      state: ConnectionState.activating,
      addresses: [],
    });

    const result = getNetworkStatus([autoConnection]);

    expect(result.status).toBe(NetworkStatus.AUTO);
  });

  it("returns MANUAL status when there are only manual connections", () => {
    const manualConnection = createConnection("Network 1", {
      method4: ConnectionMethod.MANUAL,
      method6: ConnectionMethod.MANUAL,
      state: ConnectionState.activating,
    });

    const result = getNetworkStatus([manualConnection]);

    expect(result.status).toBe(NetworkStatus.MANUAL);
  });

  it("returns MANUAL status when connection has manual method and static IP addresses", () => {
    const manualWithStaticIp = createConnection("Network 1", {
      method4: ConnectionMethod.MANUAL,
      method6: ConnectionMethod.MANUAL,
      state: ConnectionState.activating,
      addresses: [{ address: "192.168.1.10", prefix: 24 }],
    });

    const result = getNetworkStatus([manualWithStaticIp]);

    expect(result.status).toBe(NetworkStatus.MANUAL);
  });

  it("returns MIXED status when there are both manual and auto connections", () => {
    const mixedConnection = createConnection("Network 1", {
      method4: ConnectionMethod.AUTO,
      method6: ConnectionMethod.MANUAL,
      state: ConnectionState.activating,
    });

    const result = getNetworkStatus([mixedConnection]);

    expect(result.status).toBe(NetworkStatus.MIXED);
  });

  it("returns MIXED status when there is an auto connection with static IP address", () => {
    const autoWithStaticIp = createConnection("Network 1", {
      state: ConnectionState.activating,
      addresses: [{ address: "192.168.1.10", prefix: 24 }],
    });

    const result = getNetworkStatus([autoWithStaticIp]);

    expect(result.status).toBe(NetworkStatus.MIXED);
  });
});

describe("getIpAddresses", () => {
  it("returns empty array when no devices are given", () => {
    const connection = createConnection("conn1");
    const result = getIpAddresses([], [connection]);

    expect(result).toEqual([]);
  });

  it("returns empty array when no connections are given", () => {
    const device = createDevice({
      addresses: [
        { address: "192.168.1.100", prefix: 24 },
        { address: "192.168.1.101", prefix: 24 },
      ],
    });

    const result = getIpAddresses([device], []);

    expect(result).toEqual([]);
  });

  it("returns IP addresses from devices linked to existing connections", () => {
    const connection = createConnection("conn1");
    const device = createDevice({
      connection: connection.id,
      addresses: [
        { address: "192.168.1.100", prefix: 24 },
        { address: "fe80::1", prefix: 64 },
      ],
      nameservers: ["8.8.8.8"],
    });

    const result = getIpAddresses([device], [connection]);

    expect(result).toEqual([
      { address: "192.168.1.100", prefix: 24 },
      { address: "fe80::1", prefix: 64 },
    ]);
  });

  it("filters out devices not linked to any connection", () => {
    const connection = createConnection("conn1");
    const linkedDevice = createDevice({ connection: connection.id });
    const unlinkedDevice = createDevice({
      name: "wlan0",
      type: ConnectionType.WIFI,
      state: DeviceState.DISCONNECTED,
      addresses: [{ address: "192.168.1.200", prefix: 24 }],
      gateway4: "",
      macAddress: "BB:11:22:33:44:55",
    });

    const result = getIpAddresses([linkedDevice, unlinkedDevice], [connection]);

    expect(result).toEqual([{ address: "192.168.1.100", prefix: 24 }]);
  });

  it("flattens IP addresses from multiple devices", () => {
    const connection1 = createConnection("conn1");
    const connection2 = createConnection("conn2");

    const device1 = createDevice({
      connection: connection1.id,
      addresses: [
        { address: "192.168.1.100", prefix: 24 },
        { address: "192.168.1.101", prefix: 24 },
      ],
    });

    const device2 = createDevice({
      name: "wlan0",
      connection: connection2.id,
      type: ConnectionType.WIFI,
      addresses: [{ address: "10.0.0.50", prefix: 8 }],
      gateway4: "10.0.0.1",
      macAddress: "BB:11:22:33:44:55",
    });

    const result = getIpAddresses([device1, device2], [connection1, connection2]);

    expect(result).toEqual([
      { address: "192.168.1.100", prefix: 24 },
      { address: "192.168.1.101", prefix: 24 },
      { address: "10.0.0.50", prefix: 8 },
    ]);
  });

  it("returns formatted IP addresses when formatted option is true", () => {
    const connection = createConnection("conn1");
    const device = createDevice({
      connection: connection.id,
      addresses: [
        { address: "192.168.1.100", prefix: 24 },
        { address: "fe80::1", prefix: 64 },
      ],
    });

    const result = getIpAddresses([device], [connection], { formatted: true });

    expect(result).toEqual(["192.168.1.100", "fe80::1"]);
  });

  it("returns raw IPAddress objects when formatted option is false", () => {
    const connection = createConnection("conn1");
    const device = createDevice({ connection: connection.id });

    const result = getIpAddresses([device], [connection], { formatted: false });

    expect(result).toEqual([{ address: "192.168.1.100", prefix: 24 }]);
  });

  it("returns empty array when devices have no addresses", () => {
    const connection = createConnection("conn1");
    const device = createDevice({
      connection: connection.id,
      addresses: [],
      gateway4: "",
    });

    const result = getIpAddresses([device], [connection]);

    expect(result).toEqual([]);
  });
});
