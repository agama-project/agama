/*
 * Copyright (c) [2026] SUSE LLC
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
import { installerRender, mockParams } from "~/test-utils";
import TargetLoginPage from "./TargetLoginPage";

const mockUseSystemFn = jest.fn();
const mockAddTargetFn = jest.fn();
const testingTargets = [
  {
    name: "iqn.2023-01.com.example:12ac588",
    address: "192.168.100.102",
    port: 3262,
    interface: "default",
    startup: "onboot",
  },
  {
    name: "iqn.2023-01.com.example:12ac788",
    address: "192.168.100.106",
    port: 3264,
    interface: "default",
    startup: "onboot",
  },
];

jest.mock("~/hooks/model/system/iscsi", () => ({
  ...jest.requireActual("~/hooks/model/system/iscsi"),
  useSystem: () => mockUseSystemFn(),
}));

jest.mock("~/hooks/model/config/iscsi", () => ({
  ...jest.requireActual("~/hooks/model/config/iscsi"),
  useConfig: jest.fn(),
  useAddTarget: () => mockAddTargetFn,
}));

// Needed by withL10n
jest.mock("~/hooks/model/system", () => ({
  useSystem: () => ({
    l10n: {
      keymap: "us",
      timezone: "Europe/Berlin",
      locale: "en_US",
    },
  }),
}));

describe("TargetLoginPage", () => {
  it("renders resource not found when target does not exits", () => {
    // There are no targets at all
    mockUseSystemFn.mockReturnValue({ targets: [] });
    const { rerender } = installerRender(<TargetLoginPage />);
    screen.getByRole("heading", { name: "Target not found" });
    // There are targets but not the one looking for
    mockParams({
      name: "iqn.2023-01.com.example:12ac588",
      address: "192.168.100.102",
      port: "3060",
    });
    mockUseSystemFn.mockReturnValue({
      targets: testingTargets,
    });
    rerender(<TargetLoginPage />);
    screen.getByRole("heading", { name: "Target not found" });
  });

  it("allows login without auth", async () => {
    mockParams({
      name: "iqn.2023-01.com.example:12ac588",
      address: "192.168.100.102",
      port: "3262",
    });

    mockUseSystemFn.mockReturnValue({
      targets: testingTargets,
    });

    const target = testingTargets[0];

    const { user } = installerRender(<TargetLoginPage />, { withL10n: true });
    screen.getByText(target.name);
    screen.getByText(`${target.address}:${target.port}`);

    const acceptButton = screen.getByRole("button", { name: "Accept" });
    const startupOptions = screen.getByRole("combobox", { name: "Startup" });

    await user.selectOptions(startupOptions, "Manual");
    await user.click(acceptButton);
    expect(mockAddTargetFn).toHaveBeenCalledWith({ ...target, startup: "manual" });
  });

  it("allows login with target auth", async () => {
    mockParams({
      name: "iqn.2023-01.com.example:12ac588",
      address: "192.168.100.102",
      port: "3262",
    });

    mockUseSystemFn.mockReturnValue({
      targets: testingTargets,
    });

    const target = testingTargets[0];

    const { user } = installerRender(<TargetLoginPage />, { withL10n: true });
    screen.getByText(target.name);
    screen.getByText(`${target.address}:${target.port}`);

    const acceptButton = screen.getByRole("button", { name: "Accept" });
    const startupOptions = screen.getByRole("combobox", { name: "Startup" });

    await user.selectOptions(startupOptions, "Manual");

    await user.click(acceptButton);
    const provideAuthSwitch = screen.getByRole("switch", { name: "Provide authentication" });
    await user.click(provideAuthSwitch);
    const username = screen.getByRole("textbox", { name: "User name" });
    const password = screen.getByLabelText("Password");
    await user.type(username, "john");
    await user.type(password, "secret");
    await user.click(acceptButton);
    expect(mockAddTargetFn).toHaveBeenCalledWith({
      ...target,
      startup: "manual",
      authByTarget: { username: "john", password: "secret" },
    });
  });

  it("allows login with target and initiator auth", async () => {
    mockParams({
      name: "iqn.2023-01.com.example:12ac588",
      address: "192.168.100.102",
      port: "3262",
    });
    mockUseSystemFn.mockReturnValue({
      targets: testingTargets,
    });

    const target = testingTargets[0];

    const { user } = installerRender(<TargetLoginPage />, { withL10n: true });
    screen.getByText(target.name);
    screen.getByText(`${target.address}:${target.port}`);

    const acceptButton = screen.getByRole("button", { name: "Accept" });
    const startupOptions = screen.getByRole("combobox", { name: "Startup" });

    await user.selectOptions(startupOptions, "Manual");

    await user.click(acceptButton);
    const provideAuthSwitch = screen.getByRole("switch", { name: "Provide authentication" });
    await user.click(provideAuthSwitch);
    const username = screen.getByRole("textbox", { name: "User name" });
    const password = screen.getByLabelText("Password");
    await user.type(username, "john");
    await user.type(password, "secret");
    const mutualAuthSwitch = screen.getByRole("switch", { name: "Enable mutual verification" });
    await user.click(mutualAuthSwitch);
    const initiatorUsername = screen.getByRole("textbox", { name: "Initiator user name" });
    const initiatorPassword = screen.getByLabelText("Initiator password");
    await user.type(initiatorUsername, "jane");
    await user.type(initiatorPassword, "secret");
    await user.click(acceptButton);
    expect(mockAddTargetFn).toHaveBeenCalledWith({
      ...target,
      startup: "manual",
      authByTarget: { username: "john", password: "secret" },
      authByInitiator: { username: "jane", password: "secret" },
    });
  });
});
