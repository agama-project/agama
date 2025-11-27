/*
 * Copyright (c) [2023-2024] SUSE LLC
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
import NetworkPage from "~/components/network/NetworkPage";

jest.mock(
  "~/components/product/ProductRegistrationAlert",
  () => () => -(<div>ProductRegistrationAlert Mock</div>),
);

jest.mock("~/components/network/WifiNetworksList", () => () => <div>WifiNetworksList Mock</div>);

jest.mock("~/components/network/WiredConnectionsList", () => () => (
  <div>WiredConnectionsList Mock</div>
));

jest.mock("~/components/network/NoPersistentConnectionsAlert", () => () => (
  <div>NoPersistentConnectionsAlert Mock</div>
));

const mockSystem = {
  connections: [],
  state: {
    connectivity: true,
    wiredEnabled: true,
    wirelessEnabled: false,
    persistNetwork: true,
    copyEnabled: false,
  },
};

jest.mock("~/hooks/api/system/network", () => ({
  useNetworkChanges: jest.fn(),
  useSystem: () => mockSystem,
}));

describe("NetworkPage", () => {
  it("mounts alert for all connections status", () => {
    installerRender(<NetworkPage />);
    expect(screen.queryByText("NoPersistentConnectionsAlert Mock")).toBeInTheDocument();
  });

  it("renders a section for wired connections", () => {
    installerRender(<NetworkPage />);
    expect(screen.queryByText("WiredConnectionsList Mock")).toBeInTheDocument();
  });

  describe("when Wi-Fi support is enabled", () => {
    beforeEach(() => {
      mockSystem.state.wirelessEnabled = true;
    });

    it("renders the list of Wi-Fi networks", () => {
      installerRender(<NetworkPage />);
      expect(screen.queryByText("WifiNetworksList Mock")).toBeInTheDocument();
    });
  });

  describe("when Wi-Fi support is disabled", () => {
    beforeEach(() => {
      mockSystem.state.wirelessEnabled = false;
    });

    it("does not render the list of Wi-Fi networks", () => {
      installerRender(<NetworkPage />);
      expect(
        screen.queryByText(/The system does not support Wi-Fi connections/),
      ).toBeInTheDocument();
    });
  });
});
