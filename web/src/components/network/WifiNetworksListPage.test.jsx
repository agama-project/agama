/*
 * Copyright (c) [2024] SUSE LLC
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
import { screen } from "@testing-library/react";
import { installerRender } from "~/test-utils";
import WifiNetworksListPage from "~/components/network/WifiNetworksListPage";
import { Connection, ConnectionType, DeviceState, WifiNetworkStatus } from "~/types/network";

const /** @type import("~/types/network").Device */ wlan0 = {
    name: "wlan0",
    connection: "Network 1",
    type: ConnectionType.WIFI,
    state: DeviceState.ACTIVATED,
    addresses: [{ address: "192.168.69.201", prefix: 24 }],
    nameservers: ["192.168.69.1"],
    method4: "static",
    method6: "",
    gateway4: "192.168.69.1",
    gateway6: "",
    macAddress: "AA:11:22:33:44::FF",
  };

const mockConnectionRemoval = jest.fn();
const mockAddConnection = jest.fn();
let /** @type import("~/types/network").WifiNetwork[] */ mockWifiNetworks;

// NOTE: mock only backend related queries.
// I.e., do not mock useSelectedWifi nor useSelectedWifiChange here to being able
// to test them along with user interactions
jest.mock("~/queries/network", () => ({
  ...jest.requireActual("~/queries/network"),
  useNetworkConfigChanges: jest.fn(),
  useRemoveConnectionMutation: () => ({
    mutate: mockConnectionRemoval,
  }),
  useAddConnectionMutation: () => ({
    mutate: mockAddConnection,
  }),
  useWifiNetworks: () => mockWifiNetworks,
}));

describe("WifiNetworksListPage", () => {
  describe("when visible networks are found", () => {
    beforeEach(() => {
      mockWifiNetworks = [
        {
          ssid: "Network 1",
          strength: 4,
          hwAddress: "??",
          security: ["WPA"],
          device: wlan0,
          settings: new Connection("Network 1", {
            iface: "wlan0",
            addresses: [{ address: "192.168.69.201", prefix: 24 }],
          }),
          status: WifiNetworkStatus.CONNECTED,
        },
        {
          ssid: "Network 2",
          strength: 8,
          hwAddress: "??",
          security: ["WPA"],
          settings: new Connection("Network 2", {
            iface: "wlan1",
            addresses: [{ address: "192.168.69.202", prefix: 24 }],
          }),
          status: WifiNetworkStatus.CONFIGURED,
        },
        {
          ssid: "Network 3",
          strength: 6,
          hwAddress: "??",
          security: ["WPA"],
          status: WifiNetworkStatus.NOT_CONFIGURED,
        },
      ];
    });

    it("renders a list of available wifi networks", () => {
      installerRender(<WifiNetworksListPage />);
      screen.getByRole("listitem", { name: "Network 1" });
      screen.getByRole("listitem", { name: "Network 2" });
      screen.getByRole("listitem", { name: "Network 3" });
    });

    it("allows opening the connection form for a hidden network", async () => {
      const { user } = installerRender(<WifiNetworksListPage />);
      const button = screen.getByRole("button", { name: "Connect to hidden network" });
      await user.click(button);
      screen.getByRole("heading", { name: "Connect to hidden network" });
      screen.getByRole("form", { name: "WiFi connection form" });
    });

    describe("and user selects a connected network", () => {
      it("renders basic network information and actions instead of the connection form", async () => {
        const { user } = installerRender(<WifiNetworksListPage />);
        const network1 = screen.getByRole("listitem", { name: "Network 1" });
        await user.click(network1);
        screen.getByRole("heading", { name: "Network 1" });
        expect(screen.queryByRole("form")).toBeNull();
        screen.getByText("192.168.69.201/24");
        screen.getByRole("button", { name: "Disconnect" });
        screen.getByRole("link", { name: "Edit" });
        screen.getByRole("button", { name: "Forget" });
      });
    });

    describe("and user selects a configured network", () => {
      it("renders actions instead of the connection form", async () => {
        const { user } = installerRender(<WifiNetworksListPage />);
        const network2 = screen.getByRole("listitem", { name: "Network 2" });
        await user.click(network2);
        screen.getByRole("heading", { name: "Network 2" });
        expect(screen.queryByRole("form")).toBeNull();
        screen.getByRole("button", { name: "Connect" });
        screen.getByRole("link", { name: "Edit" });
        screen.getByRole("button", { name: "Forget" });
      });
    });

    describe("and user selects a not configured network", () => {
      it("renders the connection form", async () => {
        const { user } = installerRender(<WifiNetworksListPage />);
        const network3 = screen.getByRole("listitem", { name: "Network 3" });
        await user.click(network3);
        screen.getByRole("heading", { name: "Network 3" });
        screen.queryByRole("form", { name: "WiFi connection form" });
      });
    });
  });

  describe("when no visible networks are found", () => {
    beforeEach(() => {
      mockWifiNetworks = [];
    });

    it("renders information about it", () => {
      installerRender(<WifiNetworksListPage />);
      screen.getByText("No visible Wi-Fi networks found");
    });

    it("allows opening the connection form for a hidden network", async () => {
      const { user } = installerRender(<WifiNetworksListPage />);
      const button = screen.getByRole("button", { name: "Connect to hidden network" });
      await user.click(button);
      screen.getByRole("heading", { name: "Connect to hidden network" });
      screen.getByRole("form", { name: "WiFi connection form" });
    });
  });
});
