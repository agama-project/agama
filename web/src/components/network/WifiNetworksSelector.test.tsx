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
import { screen } from "@testing-library/react";
import { installerRender } from "~/test-utils";
import WifiNetworksSelector from "./WifiNetworksSelector";
import { WifiNetworkStatus } from "~/types/network";

const connectedNetwork = {
  ssid: "Connected Network",
  hidden: false,
  deviceName: "wlan0",
  status: WifiNetworkStatus.CONNECTED,
  hwAddress: "00:EB:D8:17:6B:56",
  security: ["WPA2"],
  strength: 75,
};

const configuredNetwork = {
  ssid: "Configured Network",
  hidden: false,
  deviceName: "wlan0",
  status: WifiNetworkStatus.CONFIGURED,
  hwAddress: "00:EB:D8:17:6B:57",
  security: ["WPA2"],
  strength: 50,
};

const notConfiguredNetwork = {
  ssid: "Not Configured Network",
  hidden: false,
  deviceName: "wlan0",
  status: WifiNetworkStatus.NOT_CONFIGURED,
  hwAddress: "00:EB:D8:17:6B:58",
  security: [],
  strength: 25,
};

const weakNetwork = {
  ssid: "Weak Network",
  hidden: false,
  deviceName: "wlan0",
  status: WifiNetworkStatus.NOT_CONFIGURED,
  hwAddress: "00:EB:D8:17:6B:59",
  security: [],
  strength: 10,
};

const mockUseWifiNetworks = jest.fn();

jest.mock("~/hooks/model/system/network", () => ({
  ...jest.requireActual("~/hooks/model/system/network"),
  useNetworkChanges: jest.fn(),
  useWifiNetworks: () => mockUseWifiNetworks(),
}));

describe("WifiNetworksSelector", () => {
  beforeEach(() => {
    mockUseWifiNetworks.mockReturnValue([
      notConfiguredNetwork,
      weakNetwork,
      configuredNetwork,
      connectedNetwork,
    ]);
  });

  it("renders all available networks as options", () => {
    installerRender(<WifiNetworksSelector onChange={jest.fn()} />);
    const selector = screen.getByRole("combobox");
    expect(selector).toBeInTheDocument();
    screen.getByRole("option", { name: "Connected Network" });
    screen.getByRole("option", { name: "Configured Network" });
    screen.getByRole("option", { name: "Not Configured Network" });
    screen.getByRole("option", { name: "Weak Network" });
  });

  it("sorts networks by status first, then by signal strength", () => {
    installerRender(<WifiNetworksSelector onChange={jest.fn()} />);
    const options = screen.getAllByRole("option").map((o) => o.textContent);
    expect(options).toEqual([
      "Connected Network",
      "Configured Network",
      "Not Configured Network",
      "Weak Network",
    ]);
  });

  it("renders with the given value selected", () => {
    installerRender(<WifiNetworksSelector value="Configured Network" onChange={jest.fn()} />);
    expect(screen.getByRole("combobox")).toHaveValue("Configured Network");
  });
});
