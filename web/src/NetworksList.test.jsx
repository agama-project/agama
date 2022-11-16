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

describe("NetworksList", () => {
  it("renders nothing when no networks are given", async () => {
    const { container } = installerRender(<NetworksList networks={[]} />, { usingLayout: false });
    await waitFor(() => expect(container).toBeEmptyDOMElement());
  });

  it("displays networks information", async () => {
    const fakeNetworks = [
      { ssid: "Wi-Fi AP", security: ["WPA2"], strenght: 50 },
      { ssid: "Wireless AP", security: ["WPA2"], strenght: 90 }
    ];

    installerRender(<NetworksList networks={fakeNetworks} />);

    expect(screen.getByText("Wi-Fi AP")).toBeInTheDocument();
    expect(screen.getByText("Wireless AP")).toBeInTheDocument();
  });
});
