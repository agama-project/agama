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
import { screen } from "@testing-library/react";
import { installerRender, mockNavigateFn } from "~/test-utils";
import ConnectionsTable from "~/components/network/ConnectionsTable";
import { Connection, ConnectionStatus } from "~/types/network";

const mockMutateAsync = jest.fn();
const mockConnections = [
  new Connection("Wired connection 0", {
    iface: "eth0",
    addresses: [],
    status: ConnectionStatus.UP,
  }),
  new Connection("Wifi1", {
    iface: "wlan0",
    wireless: { ssid: "My Wifi", mode: "infrastructure" },
    addresses: [],
    status: ConnectionStatus.DOWN,
  }),
  new Connection("Mac connection", {
    macAddress: "00:11:22:33:44:55",
    addresses: [],
    status: ConnectionStatus.DOWN,
  }),
];

const mockDevices = [
  { name: "eth0", connection: "Wired connection 0", addresses: [] },
  { name: "wlan0", connection: "Wifi1", addresses: [] },
];

jest.mock("~/hooks/model/config/network", () => ({
  useConnections: () => mockConnections,
  useConnectionMutation: () => ({ mutateAsync: mockMutateAsync }),
}));

jest.mock("~/hooks/model/system/network", () => ({
  useDevices: () => mockDevices,
  useSystem: () => ({ state: { wirelessEnabled: true } }),
}));

describe("ConnectionsTable", () => {
  it("renders the connections in the table", () => {
    installerRender(<ConnectionsTable />);
    expect(screen.getByText("Wired connection 0")).toBeInTheDocument();
    expect(screen.getByText("Wifi1")).toBeInTheDocument();
    expect(screen.getByText("Mac connection")).toBeInTheDocument();
  });

  it("renders the Bind and Device columns", () => {
    installerRender(<ConnectionsTable />);
    // "by interface" appears twice (Wired connection 0 and Wifi1)
    expect(screen.getAllByText("by interface").length).toBe(2);
    expect(screen.getByText("by MAC")).toBeInTheDocument();
    // Device column for Wired connection 0
    expect(screen.getAllByText("eth0").length).toBeGreaterThan(0);
    // Device column for Wifi1
    expect(screen.getAllByText("wlan0").length).toBeGreaterThan(0);
  });

  it("renders the Status column", () => {
    installerRender(<ConnectionsTable />);
    // Wired connection 0 has status UP
    expect(screen.getByText("Up")).toBeInTheDocument();
    // Wifi1 has status DOWN
    expect(screen.getAllByText("Down").length).toBeGreaterThan(0);
  });

  it("filters the connections by status", async () => {
    const { user } = installerRender(<ConnectionsTable />);
    // Select Status "Up"
    await user.click(screen.getByLabelText("Status"));
    await user.click(screen.getByRole("option", { name: "Up" }));
    expect(screen.getByText("Wired connection 0")).toBeInTheDocument();
    expect(screen.queryByText("Wifi1")).not.toBeInTheDocument();

    // Select Status "Down"
    await user.click(screen.getByLabelText("Status"));
    await user.click(screen.getByRole("option", { name: "Down" }));
    expect(screen.queryByText("Wired connection 0")).not.toBeInTheDocument();
    expect(screen.getByText("Wifi1")).toBeInTheDocument();
    expect(screen.getByText("Mac connection")).toBeInTheDocument();
  });

  it("filters the connections by bind", async () => {
    const { user } = installerRender(<ConnectionsTable />);
    // Select Bind "by interface"
    await user.click(screen.getByLabelText("Bind"));
    await user.click(screen.getByRole("option", { name: "by interface" }));
    expect(screen.getByText("Wired connection 0")).toBeInTheDocument();
    expect(screen.getByText("Wifi1")).toBeInTheDocument();
    expect(screen.queryByText("Mac connection")).not.toBeInTheDocument();

    // Select Bind "by MAC"
    await user.click(screen.getByLabelText("Bind"));
    await user.click(screen.getByRole("option", { name: "by MAC" }));
    expect(screen.queryByText("Wired connection 0")).not.toBeInTheDocument();
    expect(screen.queryByText("Wifi1")).not.toBeInTheDocument();
    expect(screen.getByText("Mac connection")).toBeInTheDocument();
  });

  it("calls mutateConnection with status UP when 'Set up' is clicked", async () => {
    const { user } = installerRender(<ConnectionsTable />);
    await user.click(screen.getByRole("button", { name: /actions for Wifi1/i }));
    await user.click(screen.getByText("Set up"));
    expect(mockMutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "Wifi1",
        status: "up",
      }),
    );
  });

  it("calls mutateConnection with status DOWN when 'Set down' is clicked", async () => {
    const { user } = installerRender(<ConnectionsTable />);
    await user.click(screen.getByRole("button", { name: /actions for Wired connection 0/i }));
    await user.click(screen.getByText("Set down"));
    expect(mockMutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "Wired connection 0",
        status: "down",
      }),
    );
  });

  it("navigates to the wired connection page when 'Details' is clicked for an ethernet connection", async () => {
    const { user } = installerRender(<ConnectionsTable />);
    await user.click(screen.getByRole("button", { name: /actions for Wired connection 0/i }));
    await user.click(screen.getByText("Details"));
    expect(mockNavigateFn).toHaveBeenCalledWith("/network/wired_connection/Wired%20connection%200");
  });

  it("navigates to the wired connection page when 'Details' is clicked for a wifi connection", async () => {
    const { user } = installerRender(<ConnectionsTable />);
    await user.click(screen.getByRole("button", { name: /actions for Wifi1/i }));
    await user.click(screen.getByText("Details"));
    expect(mockNavigateFn).toHaveBeenCalledWith("/network/wired_connection/Wifi1");
  });

  it("navigates to the edit connection page when 'Edit' is clicked", async () => {
    const { user } = installerRender(<ConnectionsTable />);
    await user.click(screen.getByRole("button", { name: /actions for Wired connection 0/i }));
    await user.click(screen.getByText("Edit"));
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
});
