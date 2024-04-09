/*
 * Copyright (c) [2023] SUSE LLC
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

jest.mock("~/client");
jest.mock("~/components/core/Sidebar", () => () => <div>Agama sidebar</div>);

const wiredConnection = {
  "id": "eth0",
  "status": "up",
  "interface": "eth0",
  "method4": "manual",
  "method6": "manual",
  "addresses": [{ address: "192.168.122.20", prefix: 24 }],
  "nameservers": ["192.168.122.1"],
  "gateway4": "192.168.122.1"
}

const wiFiConnection = {
  "id": "AgamaNetwork",
  "method4": "auto",
  "method6": "auto",
  "wireless": {
    "passworkd": "agama.test",
    "security": "wpa-psk",
    "ssid": "Agama",
    "mode": "infrastructure"
  },
  "addresses": [{ address: "192.168.69.200", prefix: 24 }],
  "nameservers": [],
  "status": "down"
}

const settingsFn = jest.fn();
const connectionsFn = jest.fn();
const activeConnections = [wiredConnection, wiFiConnection];
const networkSettings = { wireless_enabled: false, hostname: "test", networking_enabled: true, connectivity: true };

describe("NetworkPage", () => {
  beforeEach(() => {
    settingsFn.mockReturnValue({ ...networkSettings });
    connectionsFn.mockReturnValue(activeConnections);

    createClient.mockImplementation(() => {
      return {
        network: {
          setUp: () => Promise.resolve(true),
          connections: () => Promise.resolve(connectionsFn()),
          accessPoints: () => Promise.resolve([]),
          onNetworkEvent: jest.fn(),
          settings: () => Promise.resolve(settingsFn())
        }
      };
    });
  });

  it("renders section for wired connections", async () => {
    installerRender(<NetworkPage />);
    const section = await screen.findByRole("region", { name: "Wired networks" });
    await within(section).findByText("eth0");
    within(section).getByText("192.168.122.20/24");
  });

  it("renders section for WiFi connections", async () => {
    installerRender(<NetworkPage />);
    const section = await screen.findByRole("region", { name: "WiFi networks" });
    await within(section).findByText("AgamaNetwork");
    within(section).getByText("192.168.69.200/24");
  });

  describe("when no wired connection is detected", () => {
    beforeEach(() => {
      connectionsFn.mockReturnValue([wiFiConnection]);
    });

    it("renders an informative message", async () => {
      installerRender(<NetworkPage />);

      const section = await screen.findByRole("region", { name: "Wired networks" });
      await within(section).findByText("No wired connections found.");
    });
  });

  describe("when no WiFi connection is detected", () => {
    beforeEach(() => {
      connectionsFn.mockReturnValue([wiredConnection]);
    });

    it("renders an informative message", async () => {
      installerRender(<NetworkPage />);

      const section = await screen.findByRole("region", { name: "WiFi networks" });
      await within(section).findByText("No WiFi connections found.");
    });

    describe("and WiFi scan is supported", () => {
      beforeEach(() => {
        settingsFn.mockReturnValue({ ...networkSettings, wireless_enabled: true });
      });

      it("displays a button for scanning WiFi networks", async () => {
        installerRender(<NetworkPage />);

        const section = await screen.findByRole("region", { name: "WiFi networks" });
        await within(section).findByRole("button", { name: "Connect to a Wi-Fi network" });
      });

      it("opens the WiFi selector dialog when user clicks for scanning WiFi networks", async () => {
        const { user } = installerRender(<NetworkPage />);
        const link = await screen.findByRole("button", { name: "Connect to a Wi-Fi network" });
        await user.click(link);
        const wifiDialog = await screen.findByRole("dialog");
        await within(wifiDialog).findByText("Connect to a Wi-Fi network");
      });
    });

    describe("but WiFi scan is not supported", () => {
      it("does not display a button for scanning WiFi networks", async () => {
        installerRender(<NetworkPage />);

        const section = await screen.findByRole("region", { name: "WiFi networks" });
        const scanWifiButton = within(section).queryByRole("button", { name: "Connect to a Wi-Fi network" });
        expect(scanWifiButton).toBeNull();
      });
    });
  });
});
