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
import { screen } from "@testing-library/react";
import { installerRender } from "~/test-utils";
import WifiConnectionForm from "./WifiConnectionForm";
import { Connection, SecurityProtocols, WifiNetworkStatus, Wireless } from "~/types/network";

const mockAddConnection = jest.fn();
const mockUpdateConnection = jest.fn();

jest.mock("~/queries/network", () => ({
  ...jest.requireActual("~/queries/network"),
  useNetworkChanges: jest.fn(),
  useAddConnectionMutation: () => ({
    mutateAsync: mockAddConnection,
  }),
  useConnectionMutation: () => ({
    mutateAsync: mockUpdateConnection,
  }),
  useConnections: () => [],
}));

const networkMock = {
  ssid: "Visible Network",
  hidden: false,
  device_name: "wlan0",
  status: WifiNetworkStatus.NOT_CONFIGURED,
  hwAddress: "00:EB:D8:17:6B:56",
  security: [SecurityProtocols.WPA],
  strength: 85,
  settings: new Connection("Visible Network", {
    wireless: new Wireless({ ssid: "Visible Network" }),
  }),
};

const publicNetworkMock = { ...networkMock, security: [] };

describe("WifiConnectionForm", () => {
  beforeEach(() => {
    mockAddConnection.mockResolvedValue(undefined);
    mockUpdateConnection.mockResolvedValue(undefined);
  });

  describe("when rendered for a public network", () => {
    it("warns the user about connecting to an unprotected network", () => {
      installerRender(<WifiConnectionForm network={publicNetworkMock} />, { withL10n: true });
      screen.getByText("Warning alert:");
      screen.getByText("Not protected network");
    });

    it("renders only the Connect and Cancel actions", () => {
      installerRender(<WifiConnectionForm network={publicNetworkMock} />, { withL10n: true });
      expect(screen.queryByRole("combobox", { name: "Security" })).toBeNull();
      screen.getByRole("button", { name: "Connect" });
      screen.getByRole("button", { name: "Cancel" });
    });
  });

  describe("when form is submitted", () => {
    it("replaces form by an informative alert ", async () => {
      const { user } = installerRender(<WifiConnectionForm network={networkMock} />, {
        withL10n: true,
      });
      screen.getByRole("form", { name: "Wi-Fi connection form" });
      const connectButton = screen.getByRole("button", { name: "Connect" });
      await user.click(connectButton);
      expect(screen.queryByRole("form", { name: "Wi-Fi connection form" })).toBeNull();
      screen.getByText("Setting up connection");
    });

    it.todo("re-render the form with an error if connection fails");

    describe("for a not configured network", () => {
      it("triggers a mutation for adding and connecting to the network", async () => {
        const { settings: _, ...notConfiguredNetwork } = networkMock;
        const { user } = installerRender(<WifiConnectionForm network={notConfiguredNetwork} />, {
          withL10n: true,
        });
        const securitySelector = screen.getByRole("combobox", { name: "Security" });
        const connectButton = screen.getByText("Connect");
        await user.selectOptions(securitySelector, "wpa-psk");
        const passwordInput = screen.getByLabelText("WPA Password");
        await user.type(passwordInput, "wifi-password");
        await user.click(connectButton);

        expect(mockUpdateConnection).not.toHaveBeenCalled();
        expect(mockAddConnection).toHaveBeenCalledWith(
          expect.objectContaining({
            wireless: expect.objectContaining({ security: "wpa-psk", password: "wifi-password" }),
          }),
        );
      });
    });

    describe("for an already configured network", () => {
      it("triggers a mutation for updating and connecting to the network", async () => {
        const { user } = installerRender(
          <WifiConnectionForm
            network={{
              ...networkMock,
              settings: new Connection(networkMock.ssid, {
                wireless: new Wireless({
                  security: "wpa-psk",
                  password: "wrong-wifi-password",
                }),
              }),
            }}
          />,
          { withL10n: true },
        );
        const connectButton = screen.getByText("Connect");
        const passwordInput = screen.getByLabelText("WPA Password");
        await user.clear(passwordInput);
        await user.type(passwordInput, "right-wifi-password");
        await user.click(connectButton);

        expect(mockAddConnection).not.toHaveBeenCalled();
        expect(mockUpdateConnection).toHaveBeenCalledWith(
          expect.objectContaining({
            id: networkMock.ssid,
            wireless: expect.objectContaining({
              security: "wpa-psk",
              password: "right-wifi-password",
            }),
          }),
        );
      });
    });
  });
});
