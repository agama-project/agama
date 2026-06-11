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
import SystemForm from "./Form";

let mockStaticHostname: string;
const mockPatchConfig = jest.fn();

jest.mock("~/api", () => ({
  ...jest.requireActual("~/api"),
  patchConfig: (config) => mockPatchConfig(config),
}));

const mockSystem = jest.fn();

jest.mock("~/hooks/model/system", () => ({
  ...jest.requireActual("~/hooks/model/system"),
  useSystem: () => mockSystem(),
}));

jest.mock("~/hooks/model/config", () => ({
  ...jest.requireActual("~/hooks/model/config"),
  useConfig: () => ({
    ntp: { sources: [] },
  }),
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

describe("SystemForm", () => {
  beforeEach(() => {
    mockSystem.mockReturnValue({});
    mockStaticHostname = "";
    mockPatchConfig.mockResolvedValue(true);
  });

  it("renders hostname and NTP settings sections", () => {
    installerRender(<SystemForm />);
    screen.getByRole("group", { name: "Hostname" });
    screen.getByRole("group", { name: "Time Synchronization Servers" });
  });

  describe("form submission", () => {
    it("does not send config when nothing changed", async () => {
      const { user } = installerRender(<SystemForm />);

      const acceptButton = screen.getByRole("button", { name: "Accept" });
      await user.click(acceptButton);

      expect(mockPatchConfig).not.toHaveBeenCalled();
      screen.getByText("No changes to apply");
    });

    it("only sends hostname config when hostname changed", async () => {
      mockStaticHostname = "my-server";
      const { user } = installerRender(<SystemForm />);

      const hostnameInput = screen.getByRole("textbox", { name: "Name" });
      await user.clear(hostnameInput);
      await user.type(hostnameInput, "new-server");

      const acceptButton = screen.getByRole("button", { name: "Accept" });
      await user.click(acceptButton);

      expect(mockPatchConfig).toHaveBeenCalledWith({
        hostname: { static: "new-server" },
      });
    });

    it("only sends NTP config when NTP settings changed", async () => {
      const { user } = installerRender(<SystemForm />);

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

    it("does not send config when switching back to initial state", async () => {
      const { user } = installerRender(<SystemForm />);

      // Switch to custom mode
      const modeButtons = screen.getAllByLabelText("Mode");
      const ntpModeButton = modeButtons[1];
      await user.click(ntpModeButton);

      const customOption = screen.getByRole("option", { name: /Custom/ });
      await user.click(customOption);

      const ntpInput = screen.getByRole("textbox", { name: "Server addresses" });
      await user.type(ntpInput, "pool.ntp.org{Enter}");

      // Switch back to default (reverting to initial state)
      await user.click(ntpModeButton);
      const defaultOption = screen.getByRole("option", { name: /Default/ });
      await user.click(defaultOption);

      const acceptButton = screen.getByRole("button", { name: "Accept" });
      await user.click(acceptButton);

      // No config should be sent because we're back to the initial state
      expect(mockPatchConfig).not.toHaveBeenCalled();
      await screen.findByText("No changes to apply");
    });

    it("sends both hostname and NTP config when both changed", async () => {
      const { user } = installerRender(<SystemForm />);

      // Change hostname mode to static
      const modeButtons = screen.getAllByLabelText("Mode");
      const hostnameModeButton = modeButtons[0];
      await user.click(hostnameModeButton);

      const staticOption = screen.getByRole("option", { name: /Static/ });
      await user.click(staticOption);

      const hostnameInput = screen.getByRole("textbox", { name: "Name" });
      await user.clear(hostnameInput);
      await user.type(hostnameInput, "test-server");

      // Change NTP to custom
      const ntpModeButton = modeButtons[1];
      await user.click(ntpModeButton);

      const customOption = screen.getByRole("option", { name: /Custom/ });
      await user.click(customOption);

      const ntpInput = screen.getByRole("textbox", { name: "Server addresses" });
      await user.type(ntpInput, "pool.ntp.org{Enter}");

      const acceptButton = screen.getByRole("button", { name: "Accept" });
      await user.click(acceptButton);

      expect(mockPatchConfig).toHaveBeenCalledWith({
        hostname: { static: "test-server" },
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
      const { user } = installerRender(<SystemForm />);

      // Make a change to trigger an update
      const modeButtons = screen.getAllByLabelText("Mode");
      const ntpModeButton = modeButtons[1];
      await user.click(ntpModeButton);

      const customOption = screen.getByRole("option", { name: /Custom/ });
      await user.click(customOption);

      const ntpInput = screen.getByRole("textbox", { name: "Server addresses" });
      await user.type(ntpInput, "pool.ntp.org{Enter}");

      const acceptButton = screen.getByRole("button", { name: "Accept" });
      await user.click(acceptButton);

      await screen.findByText("Changes successfully applied");
    });

    it("shows error alert when update fails", async () => {
      mockPatchConfig.mockRejectedValue({ message: "Network error" });
      const { user } = installerRender(<SystemForm />);

      // Change something to trigger API call
      const modeButtons = screen.getAllByLabelText("Mode");
      const ntpModeButton = modeButtons[1];
      await user.click(ntpModeButton);

      const customOption = screen.getByRole("option", { name: /Custom/ });
      await user.click(customOption);

      const ntpInput = screen.getByRole("textbox", { name: "Server addresses" });
      await user.type(ntpInput, "pool.ntp.org{Enter}");

      const acceptButton = screen.getByRole("button", { name: "Accept" });
      await user.click(acceptButton);

      screen.getByText("System settings could not be updated");
      screen.getByText("Network error");
    });
  });

  describe("validation", () => {
    it("shows error when static hostname is empty", async () => {
      const { user } = installerRender(<SystemForm />);

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

    it("shows error when custom NTP mode has no servers", async () => {
      const { user } = installerRender(<SystemForm />);

      const modeButtons = screen.getAllByLabelText("Mode");
      const ntpModeButton = modeButtons[1];
      await user.click(ntpModeButton);

      const customOption = screen.getByRole("option", { name: /Custom/ });
      await user.click(customOption);

      const acceptButton = screen.getByRole("button", { name: "Accept" });
      await user.click(acceptButton);

      expect(mockPatchConfig).not.toHaveBeenCalled();
      screen.getByText("At least one NTP server is required");
    });

    it("shows error when NTP servers are invalid", async () => {
      const { user } = installerRender(<SystemForm />);

      const modeButtons = screen.getAllByLabelText("Mode");
      const ntpModeButton = modeButtons[1];
      await user.click(ntpModeButton);

      const customOption = screen.getByRole("option", { name: /Custom/ });
      await user.click(customOption);

      const ntpInput = screen.getByRole("textbox", { name: "Server addresses" });
      await user.type(ntpInput, "invalid@server!{Enter}");

      const acceptButton = screen.getByRole("button", { name: "Accept" });
      await user.click(acceptButton);

      expect(mockPatchConfig).not.toHaveBeenCalled();
      // ArrayField shows per-entry validation errors after submit
      screen.getByText(/Invalid NTP server address/);
      // ArrayField also shows helper text with option to remove invalid entries
      screen.getByText(/Select entries to edit or remove them/);
    });

    it("accepts valid NTP server hostnames", async () => {
      const { user } = installerRender(<SystemForm />);

      const modeButtons = screen.getAllByLabelText("Mode");
      const ntpModeButton = modeButtons[1];
      await user.click(ntpModeButton);

      const customOption = screen.getByRole("option", { name: /Custom/ });
      await user.click(customOption);

      const ntpInput = screen.getByRole("textbox", { name: "Server addresses" });
      await user.type(ntpInput, "pool.ntp.org{Enter}");
      await user.type(ntpInput, "192.168.1.1{Enter}");
      await user.type(ntpInput, "2001:db8::1{Enter}");

      const acceptButton = screen.getByRole("button", { name: "Accept" });
      await user.click(acceptButton);

      expect(mockPatchConfig).toHaveBeenCalledWith({
        ntp: {
          sources: [
            {
              type: "pool",
              address: "pool.ntp.org",
              iburst: true,
              offline: false,
            },
            {
              type: "pool",
              address: "192.168.1.1",
              iburst: true,
              offline: false,
            },
            {
              type: "pool",
              address: "2001:db8::1",
              iburst: true,
              offline: false,
            },
          ],
        },
      });
    });
  });
});
