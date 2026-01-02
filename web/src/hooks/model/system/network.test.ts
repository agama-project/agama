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

import { getNetworkStatus, NetworkStatus } from "~/hooks/model/system/network";
import { Connection } from "~/model/network/types";
import { ConnectionMethod, ConnectionState } from "~/types/network";

describe("getNetworkStatus", () => {
  it("returns NOT_CONFIGURED status when no connections are given", () => {
    const result = getNetworkStatus([]);

    expect(result.status).toBe(NetworkStatus.NOT_CONFIGURED);
    expect(result.connections).toEqual([]);
    expect(result.persistentConnections).toEqual([]);
  });

  it("returns all given connections", () => {
    const persistentConnection = new Connection("Network 1", {
      method4: ConnectionMethod.AUTO,
      method6: ConnectionMethod.AUTO,
      state: ConnectionState.activating,
      persistent: true,
    });

    const nonPersistentConnection = new Connection("Network 2", {
      method4: ConnectionMethod.MANUAL,
      method6: ConnectionMethod.MANUAL,
      state: ConnectionState.activating,
      persistent: false,
    });

    const result = getNetworkStatus([persistentConnection, nonPersistentConnection]);

    expect(result.connections).toEqual([persistentConnection, nonPersistentConnection]);
  });

  it("returns given persistent connections", () => {
    const persistentConnection = new Connection("Network 1", {
      method4: ConnectionMethod.AUTO,
      method6: ConnectionMethod.AUTO,
      state: ConnectionState.activating,
      persistent: true,
    });

    const nonPersistentConnection = new Connection("Network 2", {
      method4: ConnectionMethod.MANUAL,
      method6: ConnectionMethod.MANUAL,
      state: ConnectionState.activating,
      persistent: false,
    });

    const result = getNetworkStatus([persistentConnection, nonPersistentConnection]);

    expect(result.persistentConnections).toEqual([persistentConnection]);
  });

  it("returns NO_PERSISTENT status when there are no persistent connections and includeNonPersistent is false", () => {
    const nonPersistentConnection = new Connection("Network 1", {
      method4: ConnectionMethod.MANUAL,
      method6: ConnectionMethod.MANUAL,
      state: ConnectionState.activating,
      persistent: false, // ✅ Actually non-persistent now
    });

    const result = getNetworkStatus([nonPersistentConnection], { includeNonPersistent: false });

    expect(result.status).toBe(NetworkStatus.NO_PERSISTENT);
  });

  it("checks against non-persistent connections too when includeNonPersistent is true", () => {
    const persistentConnection = new Connection("Network 1", {
      method4: ConnectionMethod.AUTO,
      method6: ConnectionMethod.AUTO,
      state: ConnectionState.activating,
      persistent: true,
    });

    const nonPersistentConnection = new Connection("Network 2", {
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
    const autoConnection = new Connection("Network 1", {
      method4: ConnectionMethod.AUTO,
      method6: ConnectionMethod.AUTO,
      state: ConnectionState.activating,
      persistent: true,
      addresses: [],
    });

    const result = getNetworkStatus([autoConnection]);

    expect(result.status).toBe(NetworkStatus.AUTO);
  });

  it("returns MANUAL status when there are only manual connections", () => {
    const manualConnection = new Connection("Network 1", {
      method4: ConnectionMethod.MANUAL,
      method6: ConnectionMethod.MANUAL,
      state: ConnectionState.activating,
      persistent: true,
    });

    const result = getNetworkStatus([manualConnection]);

    expect(result.status).toBe(NetworkStatus.MANUAL);
  });

  it("returns MANUAL status when connection has manual method and static IP addresses", () => {
    const manualWithStaticIp = new Connection("Network 1", {
      method4: ConnectionMethod.MANUAL,
      method6: ConnectionMethod.MANUAL,
      state: ConnectionState.activating,
      persistent: true,
      addresses: [{ address: "192.168.1.10", prefix: 24 }],
    });

    const result = getNetworkStatus([manualWithStaticIp]);

    expect(result.status).toBe(NetworkStatus.MANUAL);
  });

  it("returns MIXED status when there are both manual and auto connections", () => {
    const mixedConnection = new Connection("Network 1", {
      method4: ConnectionMethod.AUTO,
      method6: ConnectionMethod.MANUAL,
      state: ConnectionState.activating,
      persistent: true,
    });

    const result = getNetworkStatus([mixedConnection]);

    expect(result.status).toBe(NetworkStatus.MIXED);
  });

  it("returns MIXED status when there is an auto connection with static IP address", () => {
    const autoWithStaticIp = new Connection("Network 1", {
      method4: ConnectionMethod.AUTO,
      method6: ConnectionMethod.AUTO,
      state: ConnectionState.activating,
      persistent: true,
      addresses: [{ address: "192.168.1.10", prefix: 24 }],
    });

    const result = getNetworkStatus([autoWithStaticIp]);

    expect(result.status).toBe(NetworkStatus.MIXED);
  });
});
