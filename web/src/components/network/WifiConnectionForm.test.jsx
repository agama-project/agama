/*
 * Copyright (c) [2022-2024] SUSE LLC
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
import { plainRender } from "~/test-utils";
import WifiConnectionForm from "~/components/network/WifiConnectionForm";

const mockAddConnection = jest.fn();
const mockUpdateConnection = jest.fn();
const mockUpdateSelectedWifi = jest.fn();

jest.mock("~/queries/network", () => ({
  ...jest.requireActual("~/queries/network"),
  useNetworkConfigChanges: jest.fn(),
  useAddConnectionMutation: () => ({
    mutate: mockAddConnection,
  }),
  useConnectionMutation: () => ({
    mutate: mockUpdateConnection,
  }),
  useSelectedWifiChange: () => ({
    mutate: mockUpdateSelectedWifi,
  }),
}));

const hiddenNetworkMock = {
  hidden: true,
};

const networkMock = {
  hidden: false,
  ssid: "Visible Network",
  security: ["WPA2"],
  strength: 85,
};

describe("WifiConnectionForm", () => {
  it("renders a generic warning when mounted with no needsAuth erorr", () => {
    const errors = { errorId: true };
    plainRender(<WifiConnectionForm network={networkMock} errors={errors} />);
    const connectButton = screen.getByText("Connect");
    screen.getByText("Warning alert:");
  });

  it("renders an authentication failed warning when mounted with needsAuth erorr", () => {
    const errors = { needsAuth: true };
    plainRender(<WifiConnectionForm network={networkMock} errors={errors} />);
    const connectButton = screen.getByText("Connect");
    screen.getByText("Warning alert:");
    screen.getByText(/Authentication failed/);
  });

  describe("when mounted for connecting to a hidden network", () => {
    it("renders the SSID input", async () => {
      plainRender(<WifiConnectionForm network={hiddenNetworkMock} />);
      screen.getByRole("textbox", { name: "SSID" });
    });
  });

  describe("when mounted for connecting to a visible network", () => {
    it("does not render the SSID input", () => {
      plainRender(<WifiConnectionForm network={networkMock} />);
      expect(screen.queryByRole("textbox", { name: "SSID" })).not.toBeInTheDocument();
    });
  });

  describe("when form is send", () => {
    // Note, not using rerender for next two test examples because it doesn not work always
    // because previous first render somehow leaks in the next one.
    it("updates information about selected network (visible network version)", async () => {
      const { user } = plainRender(<WifiConnectionForm network={networkMock} />);
      const connectButton = screen.getByRole("button", { name: "Connect" });
      await user.click(connectButton);
      expect(mockUpdateSelectedWifi).toHaveBeenCalledWith({
        ssid: "Visible Network",
        needsAuth: null,
      });
    });

    it("updates information about selected network (hidden network version)", async () => {
      const { user } = plainRender(<WifiConnectionForm network={hiddenNetworkMock} />);
      const ssidInput = screen.getByRole("textbox", { name: "SSID" });
      const connectButton = screen.getByRole("button", { name: "Connect" });
      await user.type(ssidInput, "Secret Network");
      await user.click(connectButton);
      expect(mockUpdateSelectedWifi).toHaveBeenCalledWith({
        ssid: "Secret Network",
        needsAuth: null,
      });
    });

    it("disables cancel and submission actions", async () => {
      const { user } = plainRender(<WifiConnectionForm network={networkMock} />);
      const connectButton = screen.getByText("Connect");
      const cancelLink = screen.getByText("Cancel");

      expect(connectButton).not.toBeDisabled();
      expect(cancelLink).not.toBeDisabled();

      await waitFor(() => {
        user.click(connectButton);
        expect(connectButton).toBeDisabled();
        expect(cancelLink).toBeDisabled();
      });
    });

    describe("for a not configured network", () => {
      it("triggers a mutation for adding and connecting to the network", async () => {
        const { user } = plainRender(<WifiConnectionForm network={networkMock} />);
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
        const { user } = plainRender(
          <WifiConnectionForm
            network={{
              ...networkMock,
              settings: { security: "wpa-psk", password: "wrong-wifi-password" },
            }}
          />,
        );
        const connectButton = screen.getByText("Connect");
        const passwordInput = screen.getByLabelText("WPA Password");
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

  it("allows connecting to hidden network", async () => {
    const { user } = plainRender(<WifiConnectionForm network={{ hidden: true }} />);
    const ssidInput = screen.getByRole("textbox", { name: "SSID" });
    const securitySelector = screen.getByRole("combobox", { name: "Security" });
    const wpaOption = screen.getByRole("option", { name: /WPA/ });
    const connectButton = screen.getByRole("button", { name: "Connect" });
    await user.type(ssidInput, "AHiddenNetwork");
    await user.selectOptions(securitySelector, wpaOption);
    const passwordInput = screen.getByLabelText("WPA Password");
    await user.type(passwordInput, "ASecretPassword");
    await user.click(connectButton);
    expect(mockAddConnection).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "AHiddenNetwork",
        wireless: expect.objectContaining({
          hidden: true,
          ssid: "AHiddenNetwork",
          password: "ASecretPassword",
        }),
      }),
    );
  });
});
