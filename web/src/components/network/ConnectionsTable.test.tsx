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
import { screen, within } from "@testing-library/react";
import { installerRender, mockNavigateFn } from "~/test-utils";
import ConnectionsTable from "~/components/network/ConnectionsTable";
import { BondMode, Connection, ConnectionState, ConnectionStatus } from "~/types/network";

const mockMutateAsync = jest.fn();
const mockConnections = [
  new Connection("Wired connection 0", {
    iface: "eth0",
    addresses: [],
    status: ConnectionStatus.UP,
    state: ConnectionState.ACTIVATED,
  }),
  new Connection("Wifi1", {
    iface: "wlan0",
    wireless: { ssid: "My Wifi", mode: "infrastructure" },
    addresses: [],
    status: ConnectionStatus.DOWN,
    state: ConnectionState.DEACTIVATED,
  }),
  new Connection("MAC connection", {
    macAddress: "00:11:22:33:44:55",
    addresses: [],
    status: ConnectionStatus.DOWN,
    state: ConnectionState.DEACTIVATED,
  }),
];

// The top-level connections the system reports, with the ports of bonds and
// bridges nested in them.
let mockRoots = mockConnections;

const mockBond = new Connection("Bond 1", {
  iface: "bond0",
  state: ConnectionState.ACTIVATED,
  bond: {
    mode: BondMode.ACTIVE_BACKUP,
    options: "",
    ports: [
      new Connection("Port 1", { iface: "eth1", state: ConnectionState.ACTIVATED }),
      new Connection("Port 2", { iface: "eth2", state: ConnectionState.DEACTIVATED }),
    ],
  },
});

// The configured connections are the reported ones, without the runtime state
// (neither at the top level nor in the nested ports).
const mockConfigOf = (connections: Connection[]): Connection[] =>
  connections.map(({ id, state: _state, bond, ...options }) => {
    const ports = bond?.ports.map((p) => (typeof p === "string" ? p : mockConfigOf([p])[0]));
    return new Connection(id, { ...options, bond: bond && { ...bond, ports } });
  });

const mockDevices = [
  { name: "eth0", connection: "Wired connection 0", addresses: [] },
  { name: "wlan0", connection: "Wifi1", addresses: [] },
  { name: "enp2s0", connection: "MAC connection", addresses: [] },
];

jest.mock("~/hooks/model/config/network", () => ({
  useConnectionMutation: () => ({ mutateAsync: mockMutateAsync }),
  useExtendedConfig: () => ({ connections: mockConfigOf(mockRoots) }),
}));

jest.mock("~/hooks/model/system/network", () => ({
  useConnections: () => mockConnections,
  useDevices: () => mockDevices,
  useSystem: () => ({
    connections: mockRoots,
    devices: mockDevices,
    state: { wirelessEnabled: true },
  }),
}));

describe("ConnectionsTable", () => {
  beforeEach(() => {
    mockMutateAsync.mockClear();
  });

  it("renders the connections in the table", () => {
    installerRender(<ConnectionsTable />);
    expect(screen.getByText("Wired connection 0")).toBeInTheDocument();
    expect(screen.getByText("Wifi1")).toBeInTheDocument();
    expect(screen.getByText("MAC connection")).toBeInTheDocument();
  });

  it("renders the State column", () => {
    installerRender(<ConnectionsTable />);
    // Wired connection 0 has state activated
    expect(screen.getByText("Activated")).toBeInTheDocument();
    // Wifi1 has state deactivated
    expect(screen.getAllByText("Deactivated").length).toBeGreaterThan(0);
  });

  it("shows the device name with a binding hint when a connection is bound by interface name", () => {
    installerRender(<ConnectionsTable />);
    const row = screen.getByText("Wired connection 0").closest("tr");
    within(row).getByText("eth0");
    within(row).getByText("(bound by name)");
  });

  it("shows the device name with a binding hint when a connection is bound by MAC address", () => {
    installerRender(<ConnectionsTable />);
    const row = screen.getByText("MAC connection").closest("tr");
    within(row).getByText("enp2s0");
    within(row).getByText("(bound by MAC)");
  });

  it("filters the connections by state", async () => {
    const { user } = installerRender(<ConnectionsTable />);
    // Select State "Activated"
    await user.click(screen.getByLabelText("State"));
    await user.click(screen.getByRole("option", { name: "Activated" }));
    expect(screen.getByText("Wired connection 0")).toBeInTheDocument();
    expect(screen.queryByText("Wifi1")).not.toBeInTheDocument();

    // Select State "Deactivated"
    await user.click(screen.getByLabelText("State"));
    await user.click(screen.getByRole("option", { name: "Deactivated" }));
    expect(screen.queryByText("Wired connection 0")).not.toBeInTheDocument();
    expect(screen.getByText("Wifi1")).toBeInTheDocument();
    expect(screen.getByText("MAC connection")).toBeInTheDocument();
  });

  it("calls mutateConnection with status UP when 'Connect' is clicked", async () => {
    const { user } = installerRender(<ConnectionsTable />);
    await user.click(screen.getByRole("button", { name: /actions for Wifi1/i }));
    await user.click(screen.getByText("Connect"));
    expect(mockMutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "Wifi1",
        status: "up",
      }),
    );
  });

  it("calls mutateConnection with status DOWN when 'Disconnect' is clicked", async () => {
    const { user } = installerRender(<ConnectionsTable />);
    await user.click(screen.getByRole("button", { name: /actions for Wired connection 0/i }));
    await user.click(screen.getByText("Disconnect"));
    expect(mockMutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "Wired connection 0",
        status: "down",
      }),
    );
  });

  it("updates the configured connection, without the state reported by the system", async () => {
    const { user } = installerRender(<ConnectionsTable />);
    await user.click(screen.getByRole("button", { name: /actions for Wired connection 0/i }));
    await user.click(screen.getByText("Disconnect"));
    expect(mockMutateAsync).toHaveBeenCalledTimes(1);
    expect(mockMutateAsync.mock.calls[0][0].state).toBeUndefined();
  });

  it("navigates to the connection details page when 'Details' is clicked for an ethernet connection", async () => {
    const { user } = installerRender(<ConnectionsTable />);
    await user.click(screen.getByRole("button", { name: /actions for Wired connection 0/i }));
    await user.click(screen.getByText("Details"));
    expect(mockNavigateFn).toHaveBeenCalledWith(
      "/network/connections/Wired%20connection%200/details",
    );
  });

  it("navigates to the connection details page when 'Details' is clicked for a wifi connection", async () => {
    const { user } = installerRender(<ConnectionsTable />);
    await user.click(screen.getByRole("button", { name: /actions for Wifi1/i }));
    await user.click(screen.getByText("Details"));
    expect(mockNavigateFn).toHaveBeenCalledWith("/network/connections/Wifi1/details");
  });

  it("navigates to the edit connection page when 'Edit connection' is clicked", async () => {
    const { user } = installerRender(<ConnectionsTable />);
    await user.click(screen.getByRole("button", { name: /actions for Wired connection 0/i }));
    await user.click(screen.getByText("Edit connection"));
    expect(mockNavigateFn).toHaveBeenCalledWith("/network/connections/Wired%20connection%200/edit");
  });

  it("calls mutateConnection with status DELETE when 'Delete' is clicked", async () => {
    const { user } = installerRender(<ConnectionsTable />);
    await user.click(screen.getByRole("button", { name: /actions for Wired connection 0/i }));
    await user.click(screen.getByText("Delete"));
    expect(mockMutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "Wired connection 0",
        status: "removed",
      }),
    );
  });

  describe("when there are bonds or bridges", () => {
    beforeEach(() => {
      mockRoots = [...mockConnections, mockBond];
    });

    afterEach(() => {
      mockRoots = mockConnections;
    });

    it("renders their ports as any other connection", () => {
      installerRender(<ConnectionsTable />);
      screen.getByRole("row", { name: /Bond 1/ });
      screen.getByRole("row", { name: /Port 1/ });
      screen.getByRole("row", { name: /Port 2/ });
      screen.getByText("6 connections available");
    });

    it("tells the controller of a port next to its name", () => {
      installerRender(<ConnectionsTable />);
      const port = screen.getByRole("row", { name: /Port 1/ });
      const name = within(port).getByText("(port of bond0)").parentElement;
      expect(name).toHaveTextContent(/^Port 1 \(port of bond0\)$/);

      const bond = screen.getByRole("row", { name: /Bond 1/ });
      expect(within(bond).queryByText(/port of/)).not.toBeInTheDocument();
    });

    it("updates the configured port when acting on it", async () => {
      const { user } = installerRender(<ConnectionsTable />);
      await user.click(screen.getByRole("button", { name: /actions for Port 1/i }));
      await user.click(screen.getByText("Delete"));
      expect(mockMutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({ id: "Port 1", status: "removed" }),
      );
    });
  });
});
