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
import { installerRender } from "~/test-utils";
import DevicesTable from "~/components/network/DevicesTable";
import { Connection, ConnectionStatus, Device, DeviceState, ConnectionType } from "~/types/network";

const mockMutateAsync = jest.fn();
const mockConnections = [
  new Connection("eth0-conn", { iface: "eth0", status: ConnectionStatus.UP }),
];

jest.mock("~/hooks/model/config/network", () => ({
  useConnections: () => mockConnections,
  useConnectionMutation: () => ({ mutateAsync: mockMutateAsync }),
}));

jest.mock("~/hooks/model/system/network", () => ({
  useSystem: () => ({ state: { wirelessEnabled: true } }),
}));

const devices: Device[] = [
  {
    name: "eth0",
    type: ConnectionType.ETHERNET,
    state: DeviceState.CONNECTED,
    connection: "eth0-conn",
    addresses: [],
    nameservers: [],
    dnsSearchList: [],
    gateway4: "",
    gateway6: "",
    method4: null,
    method6: null,
    macAddress: "00:11:22:33:44:55",
  } as unknown as Device,
  {
    name: "eth1",
    type: ConnectionType.ETHERNET,
    state: DeviceState.DISCONNECTED,
    addresses: [],
    nameservers: [],
    dnsSearchList: [],
    gateway4: "",
    gateway6: "",
    method4: null,
    method6: null,
    macAddress: "00:11:22:33:44:56",
  } as unknown as Device,
];

describe("DevicesTable", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders the devices in the table", () => {
    installerRender(<DevicesTable devices={devices} />);
    expect(screen.getByText("eth0")).toBeInTheDocument();
    expect(screen.getByText("eth1")).toBeInTheDocument();
  });

  it("shows 'Disconnect' action for a connected device", async () => {
    const { user } = installerRender(<DevicesTable devices={devices} />);
    const actionsToggle = screen.getByRole("button", { name: /actions for eth0/i });
    await user.click(actionsToggle);

    expect(screen.getByText("Disconnect")).toBeInTheDocument();
    expect(screen.queryByText("Connect")).not.toBeInTheDocument();
  });

  it("shows 'Connect' action for a disconnected device", async () => {
    const { user } = installerRender(<DevicesTable devices={devices} />);
    const actionsToggle = screen.getByRole("button", { name: /actions for eth1/i });
    await user.click(actionsToggle);

    expect(screen.getByText("Connect")).toBeInTheDocument();
    expect(screen.queryByText("Disconnect")).not.toBeInTheDocument();
  });

  it("shows 'Remove connection' action for a device with an associated connection", async () => {
    const { user } = installerRender(<DevicesTable devices={devices} />);
    const actionsToggle = screen.getByRole("button", { name: /actions for eth0/i });
    await user.click(actionsToggle);

    expect(screen.getByText("Remove connection")).toBeInTheDocument();
  });

  it("does not show 'Remove connection' action for a device without an associated connection", async () => {
    const { user } = installerRender(<DevicesTable devices={devices} />);
    const actionsToggle = screen.getByRole("button", { name: /actions for eth1/i });
    await user.click(actionsToggle);

    expect(screen.queryByText("Remove connection")).not.toBeInTheDocument();
  });

  it("calls mutateConnection with status removed when 'Remove connection' is clicked", async () => {
    const { user } = installerRender(<DevicesTable devices={devices} />);
    const actionsToggle = screen.getByRole("button", { name: /actions for eth0/i });
    await user.click(actionsToggle);

    const removeAction = screen.getByText("Remove connection");
    await user.click(removeAction);

    expect(mockMutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "eth0-conn",
        status: "removed",
      }),
    );
  });
});
