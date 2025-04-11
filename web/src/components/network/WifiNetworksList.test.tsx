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

import React from "react";
import { screen } from "@testing-library/react";
import { installerRender } from "~/test-utils";
import WifiNetworksList from "~/components/network/WifiNetworksList";
import {
  Connection,
  ConnectionMethod,
  ConnectionType,
  Device,
  DeviceState,
  SecurityProtocols,
  WifiNetwork,
  WifiNetworkStatus,
} from "~/types/network";

const wlan0: Device = {
  name: "wlan0",
  connection: "Network 1",
  type: ConnectionType.WIFI,
  state: DeviceState.CONNECTED,
  addresses: [{ address: "192.168.69.201", prefix: 24 }],
  nameservers: ["192.168.69.1"],
  method4: ConnectionMethod.MANUAL,
  method6: ConnectionMethod.AUTO,
  gateway4: "192.168.69.1",
  gateway6: "",
  macAddress: "AA:11:22:33:44::FF",
};

const mockConnectionRemoval = jest.fn();
const mockAddConnection = jest.fn();
let mockWifiNetworks: WifiNetwork[];

jest.mock("~/queries/network", () => ({
  ...jest.requireActual("~/queries/network"),
  useNetworkChanges: jest.fn(),
  useRemoveConnectionMutation: () => ({
    mutate: mockConnectionRemoval,
  }),
  useAddConnectionMutation: () => ({
    mutate: mockAddConnection,
  }),
  useWifiNetworks: () => mockWifiNetworks,
}));

describe("WifiNetworksList", () => {
  describe("when visible networks are found", () => {
    beforeEach(() => {
      mockWifiNetworks = [
        {
          ssid: "Network 1",
          strength: 25,
          hwAddress: "??",
          security: [SecurityProtocols.RSN],
          device: wlan0,
          settings: new Connection("Network 1", {
            iface: "wlan0",
            addresses: [{ address: "192.168.69.201", prefix: 24 }],
          }),
          status: WifiNetworkStatus.CONNECTED,
        },
        {
          ssid: "Network 2",
          strength: 88,
          hwAddress: "??",
          security: [SecurityProtocols.RSN],
          settings: new Connection("Network 2", {
            iface: "wlan1",
            addresses: [{ address: "192.168.69.202", prefix: 24 }],
          }),
          status: WifiNetworkStatus.CONFIGURED,
        },
        {
          ssid: "Network 3",
          strength: 66,
          hwAddress: "??",
          security: [],
          status: WifiNetworkStatus.NOT_CONFIGURED,
        },
      ];
    });

    it("renders a list of available wifi networks", () => {
      // @ts-expect-error: you need to specify the aria-label
      installerRender(<WifiNetworksList />);
      screen.getByRole("listitem", { name: "Secured network Network 1 Weak signal" });
      screen.getByRole("listitem", { name: "Secured network Network 2 Excellent signal" });
      screen.getByRole("listitem", { name: "Public network Network 3 Good signal" });
    });

    describe.skip("and user selects a connected network", () => {
      it("renders basic network information and actions instead of the connection form", async () => {
        // @ts-expect-error: you need to specify the aria-label
        const { user } = installerRender(<WifiNetworksList />);
        const network1 = screen.getByRole("listitem", {
          name: "Secured network Network 1 Weak signal",
        });
        await user.click(network1);
        screen.getByRole("heading", { name: "Connection details" });
        expect(screen.queryByRole("form", { name: "Wi-Fi connection form" })).toBeNull();
        screen.getByText("192.168.69.201/24");
      });
    });

    describe.skip("and user selects a configured network", () => {
      it("renders the connection form", async () => {
        // @ts-expect-error: you need to specify the aria-label
        const { user } = installerRender(<WifiNetworksList />);
        const network2 = screen.getByRole("listitem", {
          name: "Secured network Network 2 Excellent signal",
        });
        await user.click(network2);
        screen.getByRole("heading", { name: "Connect to Network 2" });
        screen.queryByRole("form", { name: "Wi-Fi connection form" });
        screen.getByRole("button", { name: "Connect" });
        screen.getByRole("button", { name: "Cancel" });
      });
    });

    describe.skip("and user selects a not configured network", () => {
      it("renders the connection form", async () => {
        // @ts-expect-error: you need to specify the aria-label
        const { user } = installerRender(<WifiNetworksList />);
        const network3 = screen.getByRole("listitem", {
          name: "Public network Network 3 Good signal",
        });
        await user.click(network3);
        screen.getByRole("heading", { name: "Connect to Network 3" });
        screen.queryByRole("form", { name: "Wi-Fi connection form" });
      });
    });
  });

  describe("when no visible networks are found", () => {
    beforeEach(() => {
      mockWifiNetworks = [];
    });

    it("renders information about it", () => {
      // @ts-expect-error: you need to specify the aria-label
      installerRender(<WifiNetworksList />);
      screen.getByText("No Wi-Fi networks were found");
    });
  });
});
