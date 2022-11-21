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
import { installerRender } from "@/test-utils";

import WifiNetworkListItem from "./WifiNetworkListItem";

jest.mock("@components/network/WifiConnectionForm", () => () => "WifiConnectionForm mock");
jest.mock("@components/network/WifiNetworkMenu", () => () => "WifiNetworkMenu mock");

const onSelectCallback = jest.fn();
const fakeNetwork = {
  ssid: "Fake Wi-Fi AP",
  security: ["WPA2"],
  strenght: 86
};

const fakeSettings = {
  wireless:  {
    password: "notSecret"
  }
};

describe("NetworkListItem", () => {
  it("renders an input radio for selecting the network", async () => {
    installerRender(<WifiNetworkListItem network={fakeNetwork} />);

    await screen.findByRole("radio", { name: fakeNetwork.ssid, checked: false });
  });

  describe("when isSelected prop is true", () => {
    it("renders network as selected", async () => {
      installerRender(<WifiNetworkListItem network={fakeNetwork} isSelected />);

      const wrapper = await screen.findByRole("article");
      expect(wrapper.classList.contains("selection-list-checked-item")).toBe(true);
    });

    it("renders the input radio as checked", async () => {
      installerRender(<WifiNetworkListItem network={fakeNetwork} isSelected />);

      await screen.findByRole("radio", { name: fakeNetwork.ssid, checked: true });
    });
  });

  describe("when isActive prop is true", () => {
    it("renders network as selected", async () => {
      installerRender(<WifiNetworkListItem network={fakeNetwork} isActive />);

      const wrapper = await screen.findByRole("article");
      expect(wrapper.classList.contains("selection-list-checked-item")).toBe(true);
    });

    it("renders the input radio as checked", async () => {
      installerRender(<WifiNetworkListItem network={fakeNetwork} isActive />);

      await screen.findByRole("radio", { name: fakeNetwork.ssid, checked: true });
    });
  });

  describe("when given network already has settings", () => {
    const network = { ...fakeNetwork, settings: { ...fakeSettings } };

    it("renders the WifiNetworkMenu", async () => {
      installerRender(<WifiNetworkListItem network={network} />);
      await screen.findByText("WifiNetworkMenu mock");
    });

    describe("and it is selected", () => {
      it("does not render the WifiConnectionForm", async () => {
        installerRender(<WifiNetworkListItem network={network} isSelected />);
        expect(screen.queryByText("WifiConnectionForm mock")).not.toBeInTheDocument();
      });
    });
  });

  describe("when given network does not have settings", () => {
    it("does not render the WifiNetworkMenu", async () => {
      installerRender(<WifiNetworkListItem network={fakeNetwork} />);
      expect(screen.queryByText("WifiNetworkMenu mock")).not.toBeInTheDocument();
    });

    describe("and it is selected", () => {
      it("renders the WifiConnectionForm", async () => {
        installerRender(<WifiNetworkListItem network={fakeNetwork} isSelected />);
        await screen.findByText("WifiConnectionForm mock");
      });

      it("renders network as focused", async () => {
        installerRender(<WifiNetworkListItem network={fakeNetwork} isSelected />);

        const wrapper = await screen.findByRole("article");
        expect(wrapper.classList.contains("selection-list-focused-item")).toBe(true);
      });
    });
  });

  describe("when the user clicks on the input radio", () => {
    it("triggers callback given into onSelect prop", async () => {
      const { user } = installerRender(
        <WifiNetworkListItem network={fakeNetwork} onSelect={onSelectCallback} />
      );
      const radio = await screen.findByRole("radio", { name: fakeNetwork.ssid });
      await user.click(radio);

      expect(onSelectCallback).toHaveBeenCalled();
    });
  });
});
