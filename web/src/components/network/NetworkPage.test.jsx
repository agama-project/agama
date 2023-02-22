/*
 * Copyright (c) [2022] SUSE LLC
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
import { screen, within } from "@testing-library/react";
import { installerRender } from "~/test-utils";
import NetworkPage from "~/components/network/NetworkPage";
import { ConnectionTypes } from "~/client/network";
import { createClient } from "~/client";

const mockNavigateFn = jest.fn();

jest.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigateFn,
}));
jest.mock("~/client");

const wiredConnection = {
  id: "wired-1",
  name: "Wired 1",
  type: ConnectionTypes.ETHERNET,
  addresses: [{ address: "192.168.122.20", prefix: 24 }]
};
const wiFiConnection = {
  id: "wifi-1",
  name: "WiFi 1",
  type: ConnectionTypes.WIFI,
  addresses: [{ address: "192.168.69.200", prefix: 24 }]
};

const settingsFn = jest.fn();
const activeConnectionsFn = jest.fn();
const activeConnections = [wiredConnection, wiFiConnection];
const networkSettings = { wifiScanSupported: false, hostname: "test" };

describe("NetworkPage", () => {
  beforeEach(() => {
    settingsFn.mockReturnValue({ ...networkSettings });
    activeConnectionsFn.mockReturnValue(activeConnections);

    createClient.mockImplementation(() => {
      return {
        network: {
          setUp: () => Promise.resolve(true),
          activeConnections: () => activeConnectionsFn,
          connections: () => Promise.resolve([]),
          accessPoints: () => [],
          onNetworkEvent: jest.fn(),
          settings: settingsFn
        }
      };
    });
  });

  it("renders section for wired connections", async () => {
    installerRender(<NetworkPage />);
    // TODO: looks for a "region" instead when possible (i.e., once the Section component gets the role region and an area-labelledby)
    const heading = await screen.findByRole("heading", { name: "Wired networks" });
    const section = heading.closest("section");
    within(section).getByText("Wired 1");
    within(section).getByText("192.168.122.20/24");
  });

  it("renders section for WiFi connections", async () => {
    installerRender(<NetworkPage />);
    const heading = await screen.findByRole("heading", { name: "WiFi networks" });
    const section = heading.closest("section");
    within(section).getByText("WiFi 1");
    within(section).getByText("192.168.69.200/24");
  });

  describe("when WiFi scan is supported", () => {
    beforeEach(() => {
      settingsFn.mockReturnValue({ ...networkSettings, wifiScanSupported: true });
    });

    it("displays a link for scanning other WiFi networks", async () => {
      installerRender(<NetworkPage />);

      const heading = await screen.findByRole("heading", { name: "WiFi networks" });
      const section = heading.closest("section");
      const scanWifiButton = within(section).getByRole("button", { name: "Connect to a Wi-Fi network" });
      expect(scanWifiButton.classList.contains("pf-m-link")).toBe(true);
    });

    it("opens the WiFi selector dialog when user clicks for scanning WiFi networks", async () => {
      const { user } = installerRender(<NetworkPage />);
      const link = await screen.findByRole("button", { name: "Connect to a Wi-Fi network" });
      await user.click(link);
      const wifiDialog = await screen.findByRole("dialog");
      within(wifiDialog).getByText("Connect to a Wi-Fi network");
    });
  });

  describe("when no wired connection is detected", () => {
    beforeEach(() => {
      activeConnectionsFn.mockReturnValue([wiFiConnection]);
    });

    it("renders an informative message", async () => {
      installerRender(<NetworkPage />);

      const heading = await screen.findByRole("heading", { name: "Wired networks" });
      const section = heading.closest("section");
      within(section).getByText("No wired connections found");
    });
  });

  describe("when no WiFi connection is detected", () => {
    beforeEach(() => {
      activeConnectionsFn.mockReturnValue([wiredConnection]);
    });

    it("renders an informative message", async () => {
      installerRender(<NetworkPage />);

      const heading = await screen.findByRole("heading", { name: "WiFi networks" });
      const section = heading.closest("section");
      within(section).getByText("No WiFi connections found");
    });

    describe("and WiFi scan is supported", () => {
      beforeEach(() => {
        settingsFn.mockReturnValue({ ...networkSettings, wifiScanSupported: true });
      });

      it("displays a button for scanning WiFi networks", async () => {
        installerRender(<NetworkPage />);

        const heading = await screen.findByRole("heading", { name: "WiFi networks" });
        const section = heading.closest("section");
        within(section).getByRole("button", { name: "Connect to a Wi-Fi network" });
      });

      it("opens the WiFi selector dialog when user clicks for scanning WiFi networks", async () => {
        const { user } = installerRender(<NetworkPage />);
        const link = await screen.findByRole("button", { name: "Connect to a Wi-Fi network" });
        await user.click(link);
        const wifiDialog = await screen.findByRole("dialog");
        within(wifiDialog).getByText("Connect to a Wi-Fi network");
      });
    });

    describe("but WiFi scan is not supported", () => {
      it("does not display a button for scanning WiFi networks", async () => {
        installerRender(<NetworkPage />);

        const heading = await screen.findByRole("heading", { name: "WiFi networks" });
        const section = heading.closest("section");
        const scanWifiButton = within(section).queryByRole("button", { name: "Connect to a Wi-Fi network" });
        expect(scanWifiButton).toBeNull();
      });
    });
  });
});
