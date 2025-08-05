/*
 * Copyright (c) [2025] SUSE LLC
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
import { plainRender } from "~/test-utils";
import WiredConnectionDetails from "./WiredConnectionDetails";
import {
  Connection,
  ConnectionMethod,
  ConnectionState,
  ConnectionType,
  Device,
  DeviceState,
} from "~/types/network";

jest.mock("~/components/network/InstallationOnlySwitch", () => () => (
  <div>InstallationOnlySwitch mock</div>
));

const mockDevice: Device = {
  name: "enp1s0",
  connection: "Network #1",
  type: ConnectionType.ETHERNET,
  state: DeviceState.CONNECTED,
  addresses: [{ address: "192.168.69.201", prefix: 24 }],
  nameservers: ["192.168.69.100"],
  gateway4: "192.168.69.4",
  gateway6: "192.168.69.6",
  method4: ConnectionMethod.AUTO,
  method6: ConnectionMethod.AUTO,
  macAddress: "AA:11:22:33:44::FF",
  routes4: [],
  routes6: [],
};

const mockConnection: Connection = new Connection("Network #1", {
  state: ConnectionState.activated,
  iface: "enp1s0",
});

jest.mock("~/queries/network", () => ({
  ...jest.requireActual("~/queries/network"),
  useNetworkDevices: () => [mockDevice],
}));

describe("WiredConnectionDetails", () => {
  it("renders the device data", () => {
    plainRender(<WiredConnectionDetails connection={mockConnection} />);
    const section = screen.getByRole("region", { name: "Device" });
    within(section).getByText("enp1s0");
    within(section).getByText("connected");
    within(section).getByText("AA:11:22:33:44::FF");
  });

  describe("Binding settings section", () => {
    it("renders information aobut the binding mode", () => {
      const { rerender } = plainRender(
        <WiredConnectionDetails connection={new Connection("Network #1")} />,
      );
      const section = screen.getByRole("region", { name: "Binding settings" });
      within(section).getByText("Connection is bind to any interface.");
      rerender(
        <WiredConnectionDetails
          connection={new Connection("Network #1", { macAddress: "AA:11:22:33:44::FF" })}
        />,
      );
      within(section).getByText("Connection is bind by MAC address to AA:11:22:33:44::FF.");
      rerender(
        <WiredConnectionDetails connection={new Connection("Network #1", { iface: "enp1s0" })} />,
      );
      within(section).getByText("Connection is bind by interface name to enp1s0.");
    });

    it("renders a link to for editing binding settings", () => {
      plainRender(<WiredConnectionDetails connection={mockConnection} />);
      const section = screen.getByRole("region", { name: "Binding settings" });
      const editLink = within(section).getByRole("link", { name: "Edit binding settings" });
      expect(editLink).toHaveAttribute("href", "/network/connections/Network%20%231/binding/edit");
    });
  });

  it("renders the IP data", () => {
    plainRender(<WiredConnectionDetails connection={mockConnection} />);
    const section = screen.getByRole("region", { name: "IP settings" });
    within(section).getByText("IPv4 auto");
    within(section).getByText("IPv6 auto");
    // IP
    within(section).getByText("192.168.69.201/24");
    // DNS
    within(section).getByText("192.168.69.100");
    // Gateway 4
    within(section).getByText("192.168.69.4");
    // Gateway 6
    within(section).getByText("192.168.69.6");
  });

  it("renders link for editing connection", () => {
    plainRender(<WiredConnectionDetails connection={mockConnection} />);
    const section = screen.getByRole("region", { name: "IP settings" });
    const editLink = within(section).getByRole("link", { name: "Edit" });
    expect(editLink).toHaveAttribute("href", "/network/connections/Network%20%231/edit");
  });

  it("renders the switch for making connection available only during installation", () => {
    plainRender(<WiredConnectionDetails connection={mockConnection} />);
    screen.getByText("InstallationOnlySwitch mock");
  });
});
