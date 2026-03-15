/*
 * Copyright (c) [2022-2025] SUSE LLC
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
import { screen, waitFor } from "@testing-library/react";
import { installerRender, mockNavigateFn } from "~/test-utils";
import WifiConnectionForm from "./WifiConnectionForm";
import { WifiNetworkStatus } from "~/types/network";

const mockUpdateConnection = jest.fn();
const mockUseWifiNetworks = jest.fn();

jest.mock("~/hooks/model/config/network", () => ({
  ...jest.requireActual("~/hooks/model/config/network"),
  useConnectionMutation: () => ({
    mutateAsync: mockUpdateConnection,
  }),
}));

jest.mock("~/hooks/model/system/network", () => ({
  ...jest.requireActual("~/hooks/model/system/network"),
  useNetworkChanges: jest.fn(),
  useWifiNetworks: () => mockUseWifiNetworks(),
}));

const visibleNetwork = {
  ssid: "Visible Network",
  hidden: false,
  deviceName: "wlan0",
  status: WifiNetworkStatus.NOT_CONFIGURED,
  hwAddress: "00:EB:D8:17:6B:56",
  security: ["WPA2"],
  strength: 85,
};

const publicNetwork = {
  ...visibleNetwork,
  ssid: "Public Network",
  security: [],
};

describe("WifiConnectionForm", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUpdateConnection.mockResolvedValue(undefined);
    mockUseWifiNetworks.mockReturnValue([visibleNetwork, publicNetwork]);
  });

  it("renders an empty state when no networks are found", () => {
    mockUseWifiNetworks.mockReturnValue([]);
    installerRender(<WifiConnectionForm />, { withL10n: true });
    screen.getByText("No Wi-Fi networks were found");
  });

  it("renders the network selector", () => {
    installerRender(<WifiConnectionForm />, { withL10n: true });
    screen.getByRole("combobox", { name: "Network" });
  });

  describe("when a public network is selected", () => {
    it("warns the user about connecting to an unprotected network", async () => {
      const { user } = installerRender(<WifiConnectionForm />, { withL10n: true });
      await user.selectOptions(screen.getByRole("combobox", { name: "Network" }), "Public Network");
      screen.getByText("Warning alert:");
      screen.getByText("Not protected network");
    });

    it("does not render the security selector", async () => {
      const { user } = installerRender(<WifiConnectionForm />, { withL10n: true });
      await user.selectOptions(screen.getByRole("combobox", { name: "Network" }), "Public Network");
      expect(screen.queryByRole("combobox", { name: "Security" })).toBeNull();
    });
  });

  describe("when a protected network is selected", () => {
    it("renders the security selector", async () => {
      const { user } = installerRender(<WifiConnectionForm />, { withL10n: true });
      await user.selectOptions(
        screen.getByRole("combobox", { name: "Network" }),
        "Visible Network",
      );
      screen.getByRole("combobox", { name: "Security" });
    });

    it("pre-selects the security based on network supported protocols", async () => {
      const { user } = installerRender(<WifiConnectionForm />, { withL10n: true });
      await user.selectOptions(
        screen.getByRole("combobox", { name: "Network" }),
        "Visible Network",
      );
      await waitFor(() => {
        expect(screen.getByRole("combobox", { name: "Security" })).toHaveValue("wpa-psk");
      });
    });
  });

  describe("when the form is submitted", () => {
    it("triggers a mutation and navigates to the network page", async () => {
      const { user } = installerRender(<WifiConnectionForm />, { withL10n: true });
      await user.selectOptions(
        screen.getByRole("combobox", { name: "Network" }),
        "Visible Network",
      );
      await waitFor(() => {
        expect(screen.getByRole("combobox", { name: "Security" })).toHaveValue("wpa-psk");
      });
      const passwordInput = screen.getByLabelText("WPA Password");
      await user.type(passwordInput, "wifi-password");
      await user.click(screen.getByRole("button", { name: "Connect" }));
      await waitFor(() => {
        expect(mockUpdateConnection).toHaveBeenCalledWith(
          expect.objectContaining({
            wireless: expect.objectContaining({
              ssid: "Visible Network",
              security: "wpa-psk",
              password: "wifi-password",
            }),
          }),
        );
      });
      expect(mockNavigateFn).toHaveBeenCalledWith("/network");
    });
  });
});
