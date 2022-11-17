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

import { screen, waitFor } from "@testing-library/react";
import { installerRender } from "./test-utils";

import NetworksList from "./NetworksList";

const onSelectionCallback = jest.fn();

const myNetwork = {
  ssid: "My Wi-Fi Network",
  security: ["WPA2"],
  strengh: 85,
  settings: { wireless: { hidden: false } }
};

const otherNetwork = {
  ssid: "My Neighbour Network",
  security: ["WPA2"],
  strengh: 35
};

const networksMock = [myNetwork, otherNetwork];

describe("NetworksList", () => {
  it("renders nothing when no networks are given", async () => {
    const { container } = installerRender(<NetworksList networks={[]} />, { usingLayout: false });
    await waitFor(() => expect(container).toBeEmptyDOMElement());
  });

  it("displays networks information", async () => {
    installerRender(<NetworksList networks={networksMock} />);

    expect(screen.getByText("My Wi-Fi Network")).toBeInTheDocument();
    expect(screen.getByText("My Neighbour Network")).toBeInTheDocument();
  });

  describe("when the user clicks on a not selected network", () => {
    it("triggers the onSelectionCallback", async () => {
      const { user } = installerRender(
        <NetworksList networks={networksMock} onSelectionCallback={onSelectionCallback} />
      );

      const radio = await screen.findByRole("radio", { name: "My Wi-Fi Network" });
      await user.click(radio);

      expect(onSelectionCallback).toHaveBeenCalled();
    });
  });

  describe("when the user clicks on an already selected network", () => {
    it("does not trigger the onSelectionCallback", async () => {
      const { user } = installerRender(
        <NetworksList networks={networksMock} selectedNetwork={myNetwork} onSelectionCallback={onSelectionCallback} />
      );

      const radio = await screen.findByRole("radio", { name: "My Wi-Fi Network" });
      await user.click(radio);

      expect(onSelectionCallback).not.toHaveBeenCalled();
    });
  });
});
