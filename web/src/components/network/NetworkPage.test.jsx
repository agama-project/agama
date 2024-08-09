/*
 * Copyright (c) [2023-2024] SUSE LLC
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

// @ts-check

import React from "react";
import { screen, within } from "@testing-library/react";
import { installerRender, plainRender } from "~/test-utils";
import NetworkPage from "~/components/network/NetworkPage";
import { Connection, ConnectionStatus, ConnectionType } from "~/types/network";

const /** @type Connection */ wiredConnection = {
    id: "eth0",
    status: ConnectionStatus.UP,
    iface: "eth0",
    method4: "manual",
    addresses: [{ address: "192.168.122.20", prefix: 24 }],
    nameservers: ["192.168.122.1"],
    gateway4: "192.168.122.1",
  };

const /** @type Connection */ wifiConnection = {
    id: "AgamaNetwork",
    iface: "wlan0",
    method4: "auto",
    wireless: {
      ssid: "Agama",
      security: "wpa-psk",
      mode: "infrastructure",
      password: "agama.test",
    },
    addresses: [{ address: "192.168.69.200", prefix: 24 }],
    nameservers: [],
    status: "up",
  };

const ethernetDevice = {
  name: "eth0",
  connection: "eth0",
  type: ConnectionType.ETHERNET,
  addresses: [{ address: "192.168.122.20", prefix: 24 }],
  macAddress: "00:11:22:33:44::55",
};

const wifiDevice = {
  name: "wlan0",
  connection: "AgamaNetwork",
  type: ConnectionType.WIFI,
  state: "activated",
  addresses: [{ address: "192.168.69.200", prefix: 24 }],
  macAddress: "AA:11:22:33:44::FF",
};

const mockDevices = [ethernetDevice, wifiDevice];
let mockActiveConnections = [wiredConnection, wifiConnection];
let mockNetworkSettings = {
  wireless_enabled: true,
};

const mockAccessPoints = [];

jest.mock("~/queries/network", () => ({
  useNetworkConfigChanges: jest.fn(),
  useNetwork: () => ({
    connections: mockActiveConnections,
    devices: mockDevices,
    settings: mockNetworkSettings,
    accessPoints: mockAccessPoints,
  }),
}));

describe("NetworkPage", () => {
  it("renders a section for wired connections", () => {
    installerRender(<NetworkPage />);
    const section = screen.getByRole("region", { name: "Wired" });
    within(section).getByText("eth0");
    within(section).getByText("192.168.122.20/24");
  });

  it("renders a section for WiFi connections", () => {
    installerRender(<NetworkPage />);
    const section = screen.getByRole("region", { name: "Wi-Fi" });
    within(section).getByText("Connected to AgamaNetwork");
    within(section).getByText("192.168.69.200/24");
  });

  describe("when wired connection were not found", () => {
    beforeEach(() => {
      mockActiveConnections = [wifiConnection];
    });

    it("renders information about it", () => {
      installerRender(<NetworkPage />);
      screen.getByText("No wired connections found");
    });
  });

  describe("when WiFi scan is supported but no connection found", () => {
    beforeEach(() => {
      mockActiveConnections = [wiredConnection];
    });

    it("renders information about it and a link going to the connection page", () => {
      installerRender(<NetworkPage />);
      const section = screen.getByRole("region", { name: "Wi-Fi" });
      within(section).getByText("No connected yet");
      within(section).getByRole("link", { name: "Connect" });
    });
  });

  describe("when WiFi scan is not supported", () => {
    beforeEach(() => {
      mockNetworkSettings = { wireless_enabled: false };
    });

    it("renders information about it, without links for connecting", async () => {
      installerRender(<NetworkPage />);
      screen.getByText("No Wi-Fi supported");
      const connectionButton = screen.queryByRole("link", { name: "Connect" });
      expect(connectionButton).toBeNull();
    });
  });
});
