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

import { screen } from "@testing-library/react";
import { installerRender } from "~/test-utils";

import { WifiNetworksList } from "~/components/network";
import { createClient } from "~/client";

jest.mock("~/client");
const onSelectionCallback = jest.fn();

const myNetwork = {
  ssid: "My Wi-Fi Network",
  security: ["WPA2"],
  strength: 85,
  settings: { wireless: { hidden: false } }
};

const otherNetwork = {
  ssid: "My Neighbor Network",
  security: ["WPA2"],
  strength: 35
};

const networksMock = [myNetwork, otherNetwork];
const settingsFn = jest.fn();
const accessPoints = [{
  ssid: "My Wi-Fi Network",
  hw_address: "00:11:22:33:44:55",
  strength: 61,
  security: ["WPA2"]
},
{
  ssid: "My Neighbor Network",
  hw_address: "00:12:23:34:45:55",
  strength: 12,
  security: ["WPA2"]
}];

const networkSettings = { wireless_enabled: false, hostname: "test", networking_enabled: true, connectivity: true };

describe("WifiNetworksList", () => {
  beforeEach(() => {
    settingsFn.mockReturnValue({ ...networkSettings });

    createClient.mockImplementation(() => {
      return {
        network: {
          setUp: () => Promise.resolve(true),
          connections: () => Promise.resolve([]),
          accessPoints: () => Promise.resolve(accessPoints),
          onNetworkEvent: jest.fn(),
          settings: () => Promise.resolve(settingsFn())
        }
      };
    });
  });
  it("renders link for connect to a hidden network", () => {
    installerRender(<WifiNetworksList networks={[]} />);
    screen.getByRole("button", { name: "Connect to hidden network" });
  });

  it("displays networks information", async () => {
    installerRender(<WifiNetworksList networks={networksMock} />);

    expect(screen.getByText("My Wi-Fi Network")).toBeInTheDocument();
    expect(screen.getByText("My Neighbor Network")).toBeInTheDocument();
  });

  describe("when the user clicks on a not selected network", () => {
    it("triggers the onSelectionCallback", async () => {
      const { user } = installerRender(
        <WifiNetworksList networks={networksMock} onSelectionCallback={onSelectionCallback} />
      );

      const radio = await screen.findByRole("radio", { name: "My Wi-Fi Network" });
      await user.click(radio);

      expect(onSelectionCallback).toHaveBeenCalled();
    });
  });

  describe("when the user clicks on an already selected network", () => {
    it("does not trigger the onSelectionCallback", async () => {
      const { user } = installerRender(
        <WifiNetworksList networks={networksMock} selectedNetwork={myNetwork} onSelectionCallback={onSelectionCallback} />
      );

      const radio = await screen.findByRole("radio", { name: "My Wi-Fi Network" });
      await user.click(radio);

      expect(onSelectionCallback).not.toHaveBeenCalled();
    });
  });
});
