/*
 * Copyright (c) [2025-2026] SUSE LLC
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
import HostnamePage from "./HostnamePage";
import { ConnectivityState } from "~/types/network";

let mockStaticHostname: string;
const mockPatchConfig = jest.fn();

jest.mock("~/api", () => ({
  ...jest.requireActual("~/api"),
  patchConfig: (config) => mockPatchConfig(config),
}));

const system = jest.fn();

jest.mock("~/hooks/model/system", () => ({
  ...jest.requireActual("~/hooks/model/system"),
  useSystem: () => system(),
}));

jest.mock("~/hooks/model/proposal", () => ({
  ...jest.requireActual("~/hooks/model/proposal"),
  useProposal: () => ({
    network: {
      connections: [],
      state: {
        connectivity: ConnectivityState.FULL,
        copyNetwork: true,
        networkingEnabled: false,
        wirelessEnabled: false,
      },
    },
    hostname: {
      hostname: "agama-node",
      static: mockStaticHostname,
    },
  }),
}));

describe("HostnamePage", () => {
  beforeEach(() => {
    system.mockReturnValue({});
  });

  describe("when static hostname is set", () => {
    beforeEach(() => {
      mockStaticHostname = "agama-server";
      mockPatchConfig.mockResolvedValue(true);
    });

    it("shows Static mode selected with hostname input", () => {
      installerRender(<HostnamePage />);

      screen.getByLabelText("Mode");
      const hostnameInput = screen.getByRole("textbox", { name: "Value" });
      expect(hostnameInput).toHaveValue("agama-server");
    });

    it("allows switching to transient mode", async () => {
      const { user } = installerRender(<HostnamePage />);

      const modeToggle = screen.getByLabelText("Mode");
      await user.click(modeToggle);

      const transientOption = screen.getByRole("option", { name: /Transient/ });
      await user.click(transientOption);

      expect(screen.queryByRole("textbox", { name: "Value" })).not.toBeInTheDocument();
      screen.getByText(/agama-node/);

      const acceptButton = screen.getByRole("button", { name: "Accept" });
      await user.click(acceptButton);

      expect(mockPatchConfig).toHaveBeenCalledWith({
        hostname: { static: "" },
      });
      screen.getByText("Success alert:");
      screen.getByText("Hostname successfully updated");
    });
  });

  describe("when static hostname is not set", () => {
    beforeEach(() => {
      mockStaticHostname = "";
      mockPatchConfig.mockResolvedValue(true);
    });

    it("shows Transient mode selected with current hostname info", () => {
      installerRender(<HostnamePage />);

      screen.getByLabelText("Mode");
      screen.getByText(/agama-node/);
      screen.getByText(/may change/);
    });

    it("allows setting the static hostname", async () => {
      const { user } = installerRender(<HostnamePage />);

      const modeToggle = screen.getByLabelText("Mode");
      await user.click(modeToggle);

      const staticOption = screen.getByRole("option", { name: /Static/ });
      await user.click(staticOption);

      const hostnameInput = screen.getByRole("textbox", { name: "Value" });
      expect(hostnameInput).toHaveValue("");

      await user.type(hostnameInput, "testing-server");

      const acceptButton = screen.getByRole("button", { name: "Accept" });
      await user.click(acceptButton);

      expect(mockPatchConfig).toHaveBeenCalledWith({
        hostname: { static: "testing-server" },
      });
      screen.getByText("Success alert:");
      screen.getByText("Hostname successfully updated");
    });

    it("renders an error when static hostname is selected but left empty", async () => {
      const { user } = installerRender(<HostnamePage />);

      const modeToggle = screen.getByLabelText("Mode");
      await user.click(modeToggle);

      const staticOption = screen.getByRole("option", { name: /Static/ });
      await user.click(staticOption);

      const acceptButton = screen.getByRole("button", { name: "Accept" });
      await user.click(acceptButton);

      expect(mockPatchConfig).not.toHaveBeenCalled();
      screen.getByText("Enter a hostname value.");
    });

    it("renders an error if the update request fails", async () => {
      mockPatchConfig.mockRejectedValue("Fail");

      const { user } = installerRender(<HostnamePage />);
      const acceptButton = screen.getByRole("button", { name: "Accept" });

      await user.click(acceptButton);

      expect(mockPatchConfig).toHaveBeenCalledWith({
        hostname: { static: "" },
      });

      screen.getByText("Danger alert:");
      screen.getByText(/Hostname could not be updated/);
    });
  });

  describe("when selected product is not registered", () => {
    it("does not render an alert about registration", () => {
      installerRender(<HostnamePage />);
      expect(screen.queryByText("Info alert:")).toBeNull();
      expect(screen.queryByText("Product is already registered")).toBeNull();
    });
  });

  describe("when the product is not registered", () => {
    beforeEach(() => {
      system.mockReturnValue({ software: {} });
    });

    it("does not render an alert about registration", () => {
      installerRender(<HostnamePage />);
      expect(screen.queryByText("Info alert:")).toBeNull();
      expect(screen.queryByText("Product is already registered")).toBeNull();
    });
  });

  describe("when the selected product is registered", () => {
    beforeEach(() => {
      system.mockReturnValue({
        software: {
          registration: {
            code: "12345",
          },
        },
      });
    });

    it("renders an alert to let user know that changes will not have effect in the registration", () => {
      installerRender(<HostnamePage />);
      screen.getByText("Info alert:");
      screen.getByText("Registered hostname will not change");
      screen.getByText(/will not affect the hostname stored at the registration server/);
    });
  });
});
