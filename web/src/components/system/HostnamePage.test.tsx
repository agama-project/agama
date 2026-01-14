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
        connectivity: true,
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

    it("does not render a custom alert with current value and mode", () => {
      installerRender(<HostnamePage />);
      expect(screen.queryByText("Custom alert:")).toBeNull();
      expect(screen.queryByText(/agama-server/)).toBeNull();
    });

    it("allows unsetting the static hostname", async () => {
      const { user } = installerRender(<HostnamePage />);

      const setHostnameCheckbox = screen.getByRole("checkbox", { name: "Use static hostname" });
      const hostnameInput = screen.getByRole("textbox", { name: "Static hostname" });
      const acceptButton = screen.getByRole("button", { name: "Accept" });

      expect(setHostnameCheckbox).toBeChecked();
      expect(hostnameInput).toHaveValue("agama-server");

      await user.click(setHostnameCheckbox);
      expect(setHostnameCheckbox).not.toBeChecked();

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

    it("renders a custom alert with current value and mode", () => {
      installerRender(<HostnamePage />);
      screen.getByText("Custom alert:");
      screen.getByText(/agama-node/);
      screen.getByText(/is dynamic/);
    });

    it("allows setting the static hostname", async () => {
      const { user } = installerRender(<HostnamePage />);
      const setHostnameCheckbox = screen.getByRole("checkbox", { name: "Use static hostname" });
      const acceptButton = screen.getByRole("button", { name: "Accept" });
      expect(setHostnameCheckbox).not.toBeChecked();

      await user.click(setHostnameCheckbox);

      expect(setHostnameCheckbox).toBeChecked();
      const hostnameInput = screen.getByRole("textbox", { name: "Static hostname" });
      expect(hostnameInput).toHaveValue("");

      await user.type(hostnameInput, "testing-server");
      await user.click(acceptButton);

      expect(mockPatchConfig).toHaveBeenCalledWith({
        hostname: { static: "testing-server" },
      });
      screen.getByText("Success alert:");
      screen.getByText("Hostname successfully updated");
    });

    it("renders an error when static hostname is selected but left empty", async () => {
      const { user } = installerRender(<HostnamePage />);
      const setHostnameCheckbox = screen.getByRole("checkbox", { name: "Use static hostname" });
      const acceptButton = screen.getByRole("button", { name: "Accept" });

      await user.click(setHostnameCheckbox);
      await user.click(acceptButton);

      expect(mockPatchConfig).not.toHaveBeenCalled();
      screen.getByText("Warning alert:");
      screen.getByText("Enter a hostname.");
    });

    it("renders an error if the update request fails", async () => {
      mockPatchConfig.mockRejectedValue("Fail");

      const { user } = installerRender(<HostnamePage />);
      const acceptButton = screen.getByRole("button", { name: "Accept" });

      await user.click(acceptButton);

      expect(mockPatchConfig).toHaveBeenCalledWith({
        hostname: { static: "" },
      });

      screen.getByText("Warning alert:");
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
      screen.getByText("Product is already registered");
      screen.getByText(/will not change the currently registered hostname/);
    });
  });
});
