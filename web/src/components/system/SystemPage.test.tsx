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
import SystemPage from "./SystemPage";

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
    hostname: {
      hostname: "agama-node",
      static: mockStaticHostname,
    },
  }),
}));

describe("SystemPage", () => {
  beforeEach(() => {
    system.mockReturnValue({});
    mockStaticHostname = "";
    mockPatchConfig.mockResolvedValue(true);
  });

  it("renders hostname and NTP settings sections", () => {
    installerRender(<SystemPage />);
    screen.getByRole("group", { name: "Hostname" });
    screen.getByRole("group", { name: "Network Time Protocol (NTP)" });
  });

  describe("form submission", () => {
    it("sends hostname and NTP config on submit", async () => {
      const { user } = installerRender(<SystemPage />);

      const acceptButton = screen.getByRole("button", { name: "Accept" });
      await user.click(acceptButton);

      expect(mockPatchConfig).toHaveBeenCalledWith({
        hostname: { static: "" },
        ntp: { sources: [] },
      });
    });

    it("sends static hostname when set", async () => {
      mockStaticHostname = "my-server";
      const { user } = installerRender(<SystemPage />);

      const acceptButton = screen.getByRole("button", { name: "Accept" });
      await user.click(acceptButton);

      expect(mockPatchConfig).toHaveBeenCalledWith({
        hostname: { static: "my-server" },
        ntp: { sources: [] },
      });
    });

    it("sends custom NTP servers when configured", async () => {
      const { user } = installerRender(<SystemPage />);

      const modeButtons = screen.getAllByLabelText("Mode");
      const ntpModeButton = modeButtons[1];
      await user.click(ntpModeButton);

      const customOption = screen.getByRole("option", { name: /Custom/ });
      await user.click(customOption);

      const ntpInput = screen.getByRole("textbox", { name: "Server addresses" });
      await user.type(ntpInput, "pool.ntp.org{Enter}");

      const acceptButton = screen.getByRole("button", { name: "Accept" });
      await user.click(acceptButton);

      expect(mockPatchConfig).toHaveBeenCalledWith({
        hostname: { static: "" },
        ntp: {
          sources: [
            {
              type: "pool",
              address: "pool.ntp.org",
              iburst: true,
              offline: false,
            },
          ],
        },
      });
    });

    it("shows success alert after successful update", async () => {
      const { user } = installerRender(<SystemPage />);

      const acceptButton = screen.getByRole("button", { name: "Accept" });
      await user.click(acceptButton);

      screen.getByText("System settings successfully updated");
    });

    it("shows error alert when update fails", async () => {
      mockPatchConfig.mockRejectedValue(new Error("Network error"));
      const { user } = installerRender(<SystemPage />);

      const acceptButton = screen.getByRole("button", { name: "Accept" });
      await user.click(acceptButton);

      screen.getByText("The system settings could not be saved");
      screen.getByText("System settings could not be updated");
    });
  });

  describe("validation", () => {
    it("shows error when static hostname is empty", async () => {
      const { user } = installerRender(<SystemPage />);

      const modeButtons = screen.getAllByLabelText("Mode");
      const hostnameModeButton = modeButtons[0];
      await user.click(hostnameModeButton);

      const staticOption = screen.getByRole("option", { name: /Static/ });
      await user.click(staticOption);

      const hostnameInput = screen.getByRole("textbox", { name: "Name" });
      await user.clear(hostnameInput);

      const acceptButton = screen.getByRole("button", { name: "Accept" });
      await user.click(acceptButton);

      expect(mockPatchConfig).not.toHaveBeenCalled();
      screen.getByText("Enter a hostname value.");
    });
  });
});
