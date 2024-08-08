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
import { installerRender, plainRender } from "~/test-utils";
import { createClient } from "~/client";

import { WifiConnectionForm } from "~/components/network";

const mockAddConnection = jest.fn();

jest.mock("~/queries/network", () => ({
  useNetworkConfigChanges: jest.fn(),
  useAddConnectionMutation: () => ({
    mutate: mockAddConnection,
  }),
}));

const hiddenNetworkMock = {
  hidden: true,
};

const networkMock = {
  hidden: false,
  ssid: "Wi-Fi Network",
  security: ["WPA2"],
  strength: 85,
};

describe("WifiConnectionForm", () => {
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

    it("triggers a mutation for adding and connecting to the network", async () => {
      const { user } = plainRender(<WifiConnectionForm network={networkMock} />);
      const securitySelector = screen.getByRole("combobox", { name: "Security" });
      const connectButton = screen.getByText("Connect");
      await user.selectOptions(securitySelector, "wpa-psk");
      const passwordInput = screen.getByLabelText("WPA Password");
      await user.type(passwordInput, "wifi-password");
      await user.click(connectButton);

      expect(mockAddConnection).toHaveBeenCalledWith(
        expect.objectContaining({
          wireless: expect.objectContaining({ security: "wpa-psk", password: "wifi-password" }),
        }),
      );
    });

    describe("and something went wrong", () => {
      beforeEach(() => {
        mockAddConnection.mockRejectedValue("Sorry, something went wrong");
      });

      it("renders a warning", async () => {
        const { user } = plainRender(<WifiConnectionForm network={networkMock} />);
        const connectButton = screen.getByText("Connect");
        await user.click(connectButton);
        screen.getByText("Warning alert:");
      });

      it("enables cancel and submission actions again", async () => {
        const { user } = plainRender(<WifiConnectionForm network={networkMock} />);
        const cancelLink = screen.getByText("Cancel");
        const connectButton = screen.getByText("Connect");

        expect(cancelLink).not.toBeDisabled();
        expect(connectButton).not.toBeDisabled();

        await waitFor(() => {
          user.click(connectButton);
          expect(cancelLink).toBeDisabled();
          expect(connectButton).toBeDisabled();
        });

        expect(cancelLink).not.toBeDisabled();
        expect(connectButton).not.toBeDisabled();
      });
    });
  });
});
