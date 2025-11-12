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
import WifiConnectionDetails from "./WifiConnectionDetails";
import {
  Connection,
  ConnectionMethod,
  ConnectionType,
  Device,
  DeviceState,
  SecurityProtocols,
  WifiNetworkStatus,
} from "~/types/network";

jest.mock("~/components/network/InstallationOnlySwitch", () => () => (
  <div>InstallationOnlySwitch mock</div>
));

const wlan0: Device = {
  name: "wlan0",
  connection: "Network 1",
  type: ConnectionType.WIFI,
  state: DeviceState.CONNECTED,
  addresses: [{ address: "192.168.69.201", prefix: 24 }],
  nameservers: ["192.168.69.100"],
  method4: ConnectionMethod.MANUAL,
  method6: ConnectionMethod.AUTO,
  gateway4: "192.168.69.4",
  gateway6: "192.168.69.6",
  macAddress: "AA:11:22:33:44::FF",
  routes4: [],
  routes6: [],
};

const mockNetwork = {
  ssid: "Network 1",
  strength: 25,
  hwAddress: "??",
  security: [SecurityProtocols.RSN],
  device_name: "wlan0",
  device: wlan0,
  settings: new Connection("Network 1", {
    iface: "wlan0",
    addresses: [{ address: "192.168.69.201", prefix: 24 }],
  }),
  status: WifiNetworkStatus.CONNECTED,
};

describe("WifiConnectionDetails", () => {
  it("renders the device data", () => {
    plainRender(<WifiConnectionDetails network={mockNetwork} />);
    const section = screen.getByRole("region", { name: "Device" });
    within(section).getByText("wlan0");
    within(section).getByText("connected");
    within(section).getByText("AA:11:22:33:44::FF");
  });

  it("renders the network data", () => {
    plainRender(<WifiConnectionDetails network={mockNetwork} />);
    const section = screen.getByRole("region", { name: "Network" });
    within(section).getByText("Network 1");
    within(section).getByText("25%");
    within(section).getByText("connected");
    within(section).getByText("WPA2");
  });

  it("renders the IP data", () => {
    plainRender(<WifiConnectionDetails network={mockNetwork} />);
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

  it("renders link for editing the connection", () => {
    plainRender(<WifiConnectionDetails network={mockNetwork} />);
    const section = screen.getByRole("region", { name: "IP settings" });
    const editLink = within(section).getByRole("link", { name: "Edit" });
    expect(editLink).toHaveAttribute("href", "/network/connections/Network%201/edit");
  });

  it("renders the switch for making connection available only during installation", () => {
    plainRender(<WifiConnectionDetails network={mockNetwork} />);
    screen.getByText("InstallationOnlySwitch mock");
  });
});
