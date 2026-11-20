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

import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import { getConfig, getExtendedConfig, patchConfig } from "~/api";
import { useConnectionMutation } from "~/hooks/model/config/network";
import { BondMode, Connection, ConnectionStatus } from "~/types/network";

jest.mock("~/api", () => ({
  ...jest.requireActual("~/api"),
  getConfig: jest.fn(),
  getExtendedConfig: jest.fn(),
  patchConfig: jest.fn(),
}));

const mockGetConfig = getConfig as jest.Mock;
const mockGetExtendedConfig = getExtendedConfig as jest.Mock;
const mockPatchConfig = patchConfig as jest.Mock;

// A bridge with a bond as its port, eth0 having been removed from the bond.
const config = {
  network: {
    connections: [{ id: "eth0", interface: "eth0", status: "removed" }],
  },
};

const extendedConfig = {
  network: {
    connections: [
      {
        id: "bridge0",
        interface: "bridge0",
        method4: "auto",
        method6: "auto",
        bridge: {
          stp: false,
          portConnections: [
            {
              id: "bond0",
              interface: "bond0",
              bond: {
                mode: "active-backup",
                options: "miimon=100",
                portConnections: [{ id: "eth1", interface: "eth1", status: "up" }],
              },
              status: "up",
            },
          ],
        },
        status: "up",
      },
    ],
  },
};

describe("useConnectionMutation", () => {
  let queryClient: QueryClient;

  const renderConnectionMutation = () =>
    renderHook(() => useConnectionMutation(), {
      wrapper: ({ children }) => (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      ),
    }).result.current;

  beforeEach(() => {
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    mockGetConfig.mockResolvedValue(config);
    mockGetExtendedConfig.mockResolvedValue(extendedConfig);
    mockPatchConfig.mockResolvedValue({});
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it("keeps a port the config does not include nested in its controllers", async () => {
    const { mutateAsync } = renderConnectionMutation();
    const bond0 = new Connection("bond0", {
      iface: "bond0",
      bond: { mode: BondMode.ACTIVE_BACKUP, options: "miimon=100", ports: ["eth1", "eth0"] },
    });

    await act(() => mutateAsync(bond0));

    expect(mockPatchConfig).toHaveBeenCalledTimes(1);
    const { connections } = mockPatchConfig.mock.calls[0][0].network;
    // bond0 is not sent on its own, which would take it out of bridge0.
    expect(connections.map((c) => c.id)).toEqual(["bridge0"]);
    const [nested] = connections[0].bridge.portConnections;
    expect(nested.id).toBe("bond0");
    expect(nested.bond.portConnections.map((p) => p.id)).toEqual(["eth1", "eth0"]);
    expect(nested.bond.portConnections[1].status).toBe(ConnectionStatus.UP);
  });

  it("adds a connection that is not a port at the top level", async () => {
    const { mutateAsync } = renderConnectionMutation();
    const eth2 = new Connection("eth2", { iface: "eth2", status: ConnectionStatus.DOWN });

    await act(() => mutateAsync(eth2));

    const { connections } = mockPatchConfig.mock.calls[0][0].network;
    expect(connections.map((c) => c.id)).toEqual(["eth0", "eth2"]);
  });
});
