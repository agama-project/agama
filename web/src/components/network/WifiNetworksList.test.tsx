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
import { installerRender, mockNavigateFn } from "~/test-utils";
import WifiNetworksList from "~/components/network/WifiNetworksList";
import {
  Connection,
  ConnectionMethod,
  ConnectionState,
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

let mockWifiNetworks: WifiNetwork[];
let mockWifiConnections: Connection[];

jest.mock("~/hooks/api/proposal/network", () => ({
  ...jest.requireActual("~/hooks/api/proposal/network"),
  useConnections: () => mockWifiConnections,
}));

jest.mock("~/hooks/api/system/network", () => ({
  ...jest.requireActual("~/hooks/api/system/network"),
  useNetworkChanges: jest.fn(),
  useWifiNetworks: () => mockWifiNetworks,
  useConnections: () => mockWifiConnections,
}));

describe("WifiNetworksList", () => {
  describe("when visible networks are found", () => {
    beforeEach(() => {
      mockWifiConnections = [
        new Connection("Newtwork 2", {
          method4: ConnectionMethod.AUTO,
          method6: ConnectionMethod.AUTO,
          wireless: {
            security: "none",
            ssid: "Network 2",
            mode: "infrastructure",
          },
          state: ConnectionState.activating,
        }),
      ];

      mockWifiNetworks = [
        {
          ssid: "Network 1",
          strength: 25,
          hwAddress: "??",
          security: [SecurityProtocols.RSN],
          deviceName: "wlan0",
          device: wlan0,
          settings: new Connection("Network 1", {
            iface: "wlan0",
            addresses: [{ address: "192.168.69.201", prefix: 24 }],
          }),
          status: WifiNetworkStatus.CONNECTED,
        },
        {
          deviceName: "wlan1",
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
          deviceName: "wlan0",
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
      screen.getByLabelText("Secured network Network 1 Weak signal");
      screen.getByLabelText("Secured network Network 2 Excellent signal");
      screen.getByLabelText("Public network Network 3 Good signal");
    });

    it("renders a spinner for network in connecting state", () => {
      // @ts-expect-error: you need to specify the aria-label
      installerRender(<WifiNetworksList />);
      screen.getByLabelText("Secured network Network 2 Excellent signal");
      screen.getByRole("progressbar", { name: "Connecting to Network 2" });
    });

    describe("and user selects a network", () => {
      it("navigates to the Wi-Fi network path including the expected SSID", async () => {
        // @ts-expect-error: you need to specify the aria-label
        const { user } = installerRender(<WifiNetworksList />);
        const network1 = screen.getByLabelText("Secured network Network 1 Weak signal");
        await user.click(network1);
        expect(mockNavigateFn).toHaveBeenCalledWith(expect.stringContaining("Network%201"));
      });
    });

    describe("and the connection is persistent", () => {
      beforeEach(() => {
        mockWifiConnections = [
          new Connection("Newtwork 2", {
            method4: ConnectionMethod.AUTO,
            method6: ConnectionMethod.AUTO,
            wireless: {
              security: "none",
              ssid: "Network 2",
              mode: "infrastructure",
            },
            state: ConnectionState.activating,
            persistent: true,
          }),
        ];

        mockWifiNetworks = [
          {
            deviceName: "wlan1",
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
        ];
      });

      it("does not render any hint", () => {
        // @ts-expect-error: you need to specify the aria-label
        installerRender(<WifiNetworksList />);
        expect(screen.queryByText("Configured for installation only")).toBeNull;
      });
    });

    describe("and the connection is not persistent", () => {
      beforeEach(() => {
        mockWifiConnections = [
          new Connection("Newtwork 2", {
            method4: ConnectionMethod.AUTO,
            method6: ConnectionMethod.AUTO,
            wireless: {
              security: "none",
              ssid: "Network 2",
              mode: "infrastructure",
            },
            state: ConnectionState.activating,
            persistent: false,
          }),
        ];

        mockWifiNetworks = [
          {
            deviceName: "wlan1",
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
        ];
      });

      it("renders an installation only hint", () => {
        // @ts-expect-error: you need to specify the aria-label
        installerRender(<WifiNetworksList />);
        screen.getByText("Configured for installation only");
      });
    });

    describe.skip("and user selects a connected network", () => {
      it("renders basic network information and actions instead of the connection form", async () => {
        // @ts-expect-error: you need to specify the aria-label
        const { user } = installerRender(<WifiNetworksList />);
        const network1 = screen.getByLabelText("Secured network Network 1 Weak signal");
        await user.click(network1);
        screen.getByRole("heading", { name: "Connection details" });
        expect(screen.queryByRole("form", { name: "Wi-Fi connection form" })).toBeNull();
        screen.getByLabelText("192.168.69.201/24");
      });
    });

    describe.skip("and user selects a configured network", () => {
      it("renders the connection form", async () => {
        // @ts-expect-error: you need to specify the aria-label
        const { user } = installerRender(<WifiNetworksList />);
        const network2 = screen.getByLabelText("Secured network Network 2 Excellent signal");
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
        const network3 = screen.getByLabelText("Public network Network 3 Good signal");
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
