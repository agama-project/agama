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
import { ConnectionType, DeviceState, WifiNetworkStatus } from "~/types/network";

const wifiDevice = {
  name: "wlan0",
  connection: "AgamaNetwork",
  type: ConnectionType.WIFI,
  state: DeviceState.ACTIVATED,
  addresses: [{ address: "192.168.69.200", prefix: 24 }],
  nameservers: "192.168.69.1",
  method4: "static",
  method6: "",
  gateway4: "192.168.69.1",
  gateway6: "",
  macAddress: "AA:11:22:33:44::FF",
};

const mockSelectedWifi = {};
const mockSelectedWifiMutation = jest.fn();
const mockConnectionRemoval = jest.fn();
const mockAddConnection = jest.fn();
let /** @type import("~/types/network").WifiNetwork[] */ mockWifiNetworks;

jest.mock("~/queries/network", () => ({
  ...jest.requireActual("~/queries/network"),
  useNetworkConfigChanges: jest.fn(),
  // useSelectedWifi: jest.fn().mockResolvedValue(mockSelectedWifi),
  // useSelectedWifiChange: () => ({
  //   mutate: mockSelectedWifiMutation,
  // }),
  useRemoveConnectionMutation: () => ({
    mutate: mockConnectionRemoval,
  }),
  useAddConnectionMutation: () => ({
    mutate: mockAddConnection,
  }),
  useWifiNetworks: () => mockWifiNetworks,
}));

describe("WifiNetworksListPage", () => {
  describe("when wifi networks are found", () => {
    beforeEach(() => {
      mockWifiNetworks = [
        {
          ssid: "Agama Network 1",
          strength: 4,
          hwAddress: "??",
          security: ["WPA"],
          device: wifiDevice,
          status: WifiNetworkStatus.CONNECTED,
        },
        {
          ssid: "Agama Network 2",
          strength: 8,
          hwAddress: "??",
          security: ["WPA"],
          status: WifiNetworkStatus.NOT_CONFIGURED,
        },
      ];
    });

    it("renders a list of available wifi networks", () => {
      installerRender(<WifiNetworksListPage />);
      screen.getByRole("listitem", { name: "Agama Network 1" });
      screen.getByRole("listitem", { name: "Agama Network 2" });
    });

    it("allows to select a network", async () => {
      const { user } = installerRender(<WifiNetworksListPage />);
      const network2 = screen.getByRole("listitem", { name: "Agama Network 2" });
      await user.click(network2);
      screen.getByRole("heading", { name: "Agama Network 2" });
    });

    it.only("allows connecting to hidden network", async () => {
      const { user } = installerRender(<WifiNetworksListPage />);
      const button = screen.getByRole("button", { name: "Connect to hidden network" });
      await user.click(button);
      const ssidInput = screen.getByRole("textbox", { name: "SSID" });
      const securitySelector = screen.getByRole("combobox", { name: "Security" });
      const wpaOption = screen.getByRole("option", { name: /WPA/ });
      const connectButton = screen.getByRole("button", { name: "Connect" });
      await user.type(ssidInput, "AHiddenNetwork");
      await user.click(securitySelector);
      await user.click(wpaOption);
      const passwordInput = screen.getByRole("textbox", { name: "WPA Password" });
      await user.type(passwordInput, "ASecretPassword");
      await user.click(connectButton);
      expect(mockAddConnection).toHaveBeenCalledWith(
        expect.objectContaining({ ssid: "AHiddenNetowrk", password: "ASecretPassword" }),
      );
    });
  });

  describe("when no wifi network was found", () => {
    beforeEach(() => {
      mockWifiNetworks = [];
    });

    it("renders information about it", () => {
      installerRender(<WifiNetworksListPage />);
      screen.getByText("No visible Wi-Fi networks found");
    });
  });
});
