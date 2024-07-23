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
import { installerRender } from "~/test-utils";
import { createClient } from "~/client";

import { WifiConnectionForm } from "~/components/network";

jest.mock("~/client");

jest.mock("~/queries/network", () => ({
  useNetworkConfigChanges: jest.fn(),
}));

Element.prototype.scrollIntoView = jest.fn();

const hiddenNetworkMock = {
  hidden: true,
};

const networkMock = {
  hidden: false,
  ssid: "Wi-Fi Network",
  security: ["WPA2"],
  strength: 85,
};

const addAndConnectToFn = jest.fn().mockResolvedValue({});

beforeEach(() => {
  createClient.mockImplementation(() => {
    return {
      network: {
        addAndConnectTo: addAndConnectToFn,
      },
    };
  });
});

describe("WifiConnectionForm", () => {
  describe("when mounted for connecting to a hidden network", () => {
    it("renders the SSID input", async () => {
      const { user } = installerRender(<WifiConnectionForm network={hiddenNetworkMock} />);

      const ssidInput = screen.getByLabelText("SSID");

      await user.type(ssidInput, "HiddenWiFi");
    });
  });

  describe("when mounted for connecting to a visible network", () => {
    it("does not render the SSID input", () => {
      installerRender(<WifiConnectionForm network={networkMock} />);
      expect(screen.queryByLabelText("SSID")).not.toBeInTheDocument();
    });
  });

  describe("when form is send", () => {
    it("disables cancel and submission actions", async () => {
      const { user } = installerRender(<WifiConnectionForm network={networkMock} />);
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

    it("calls network service for adding and connecting to the network", async () => {
      const { user } = installerRender(<WifiConnectionForm network={networkMock} />);

      const securitySelector = screen.getByLabelText("Security");
      await user.selectOptions(securitySelector, "wpa-psk");
      const passwordInput = screen.getByLabelText("WPA Password");
      await user.type(passwordInput, "wifi-password");

      const connectButton = screen.getByText("Connect");
      await user.click(connectButton);

      expect(addAndConnectToFn).toHaveBeenCalledWith(
        "Wi-Fi Network",
        expect.objectContaining({ security: "wpa-psk", password: "wifi-password" }),
      );
    });

    describe("and something went wrong", () => {
      beforeEach(() => {
        addAndConnectToFn.mockRejectedValue("Sorry, something went wrong");
      });

      it("renders a warning", async () => {
        const { user } = installerRender(<WifiConnectionForm network={networkMock} />);
        const connectButton = screen.getByText("Connect");

        await user.click(connectButton);
        screen.getByText("Warning alert:");
      });

      it("enables cancel and submission actions again", async () => {
        const { user } = installerRender(<WifiConnectionForm network={networkMock} />);
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
