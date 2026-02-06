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
const mockUseConfigFn = jest.fn();
const mockAddOrEditTargetFnt = jest.fn();
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
  useConfig: () => mockUseConfigFn(),
  useAddOrEditTarget: () => mockAddOrEditTargetFnt,
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

  it("does not render resource not found when target exists in system", () => {
    mockParams({
      name: testingTargets[0].name,
      address: testingTargets[0].address,
      port: String(testingTargets[0].port),
    });
    mockUseSystemFn.mockReturnValue({ targets: testingTargets });
    mockUseConfigFn.mockReturnValue({ targets: [] });

    installerRender(<TargetLoginPage />, { withL10n: true });

    screen.getByText(testingTargets[0].name);
    expect(screen.queryByRole("heading", { name: "Target not found" })).toBeNull();
  });

  it("does not render resource not found when target exists in config", () => {
    mockParams({
      name: testingTargets[0].name,
      address: testingTargets[0].address,
      port: String(testingTargets[0].port),
    });

    mockUseSystemFn.mockReturnValue({ targets: [] });
    mockUseConfigFn.mockReturnValue({ targets: testingTargets });

    installerRender(<TargetLoginPage />, { withL10n: true });

    screen.getByText(testingTargets[0].name);
    expect(screen.queryByRole("heading", { name: "Target not found" })).toBeNull();
  });

  it("does not render resource not found when target exists in both system and config", () => {
    mockParams({
      name: testingTargets[0].name,
      address: testingTargets[0].address,
      port: String(testingTargets[0].port),
    });

    mockUseSystemFn.mockReturnValue({ targets: testingTargets });
    mockUseConfigFn.mockReturnValue({ targets: testingTargets });

    installerRender(<TargetLoginPage />, { withL10n: true });

    screen.getByText(testingTargets[0].name);
    expect(screen.queryByRole("heading", { name: "Target not found" })).toBeNull();
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
    expect(mockAddOrEditTargetFnt).toHaveBeenCalledWith({ ...target, startup: "manual" });
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
    expect(mockAddOrEditTargetFnt).toHaveBeenCalledWith({
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
    expect(mockAddOrEditTargetFnt).toHaveBeenCalledWith({
      ...target,
      startup: "manual",
      authByTarget: { username: "john", password: "secret" },
      authByInitiator: { username: "jane", password: "secret" },
    });
  });

  it("pre-populates form with existing target authentication", async () => {
    mockParams({
      name: "iqn.2023-01.com.example:12ac588",
      address: "192.168.100.102",
      port: "3262",
    });

    const configTarget = {
      name: "iqn.2023-01.com.example:12ac588",
      address: "192.168.100.102",
      port: 3262,
      interface: "default",
      startup: "onboot",
      authByTarget: { username: "john", password: "secret123" },
      authByInitiator: { username: "jane", password: "secret456" },
    };

    mockUseSystemFn.mockReturnValue({ targets: [] });
    mockUseConfigFn.mockReturnValue({ targets: [configTarget] });

    installerRender(<TargetLoginPage />, { withL10n: true });

    const provideAuthSwitch = screen.getByRole("switch", { name: "Provide authentication" });
    expect(provideAuthSwitch).toBeChecked();

    const mutualAuthSwitch = screen.getByRole("switch", { name: "Enable mutual verification" });
    expect(mutualAuthSwitch).toBeChecked();

    const username = screen.getByRole("textbox", { name: "User name" });
    expect(username).toHaveValue("john");

    const password = screen.getByLabelText("Password");
    expect(password).toHaveValue("secret123");

    const initiatorUsername = screen.getByRole("textbox", { name: "Initiator user name" });
    expect(initiatorUsername).toHaveValue("jane");

    const initiatorPassword = screen.getByLabelText("Initiator password");
    expect(initiatorPassword).toHaveValue("secret456");
  });

  it("pre-populates only target auth when initiator auth is not configured", async () => {
    mockParams({
      name: "iqn.2023-01.com.example:12ac588",
      address: "192.168.100.102",
      port: "3262",
    });

    const configTarget = {
      name: "iqn.2023-01.com.example:12ac588",
      address: "192.168.100.102",
      port: 3262,
      interface: "default",
      startup: "onboot",
      authByTarget: { username: "john", password: "secret123" },
    };

    mockUseSystemFn.mockReturnValue({ targets: [] });
    mockUseConfigFn.mockReturnValue({ targets: [configTarget] });

    installerRender(<TargetLoginPage />, { withL10n: true });

    const provideAuthSwitch = screen.getByRole("switch", { name: "Provide authentication" });
    expect(provideAuthSwitch).toBeChecked();

    const mutualAuthSwitch = screen.getByRole("switch", { name: "Enable mutual verification" });
    expect(mutualAuthSwitch).not.toBeChecked();

    const username = screen.getByRole("textbox", { name: "User name" });
    expect(username).toHaveValue("john");

    const password = screen.getByLabelText("Password");
    expect(password).toHaveValue("secret123");

    expect(screen.queryByRole("textbox", { name: "Initiator user name" })).not.toBeInTheDocument();
  });

  it("allows editing pre-populated authentication data", async () => {
    mockParams({
      name: "iqn.2023-01.com.example:12ac588",
      address: "192.168.100.102",
      port: "3262",
    });

    const configTarget = {
      name: "iqn.2023-01.com.example:12ac588",
      address: "192.168.100.102",
      port: 3262,
      interface: "default",
      startup: "automatic",
      authByTarget: { username: "john", password: "secret123" },
    };

    mockUseSystemFn.mockReturnValue({ targets: [] });
    mockUseConfigFn.mockReturnValue({ targets: [configTarget] });

    const { user } = installerRender(<TargetLoginPage />, { withL10n: true });

    const acceptButton = screen.getByRole("button", { name: "Accept" });
    const username = screen.getByRole("textbox", { name: "User name" });
    const password = screen.getByLabelText("Password");

    await user.clear(username);
    await user.type(username, "new_user");

    await user.clear(password);
    await user.type(password, "new_pass");

    await user.click(acceptButton);

    expect(mockAddOrEditTargetFnt).toHaveBeenCalledWith({
      name: configTarget.name,
      address: configTarget.address,
      port: configTarget.port,
      interface: configTarget.interface,
      startup: "automatic",
      authByTarget: { username: "new_user", password: "new_pass" },
    });
  });

  it("uses system target when config target is not available", async () => {
    mockParams({
      name: "iqn.2023-01.com.example:12ac588",
      address: "192.168.100.102",
      port: "3262",
    });

    mockUseSystemFn.mockReturnValue({ targets: testingTargets });
    mockUseConfigFn.mockReturnValue({ targets: [] });

    installerRender(<TargetLoginPage />, { withL10n: true });

    const target = testingTargets[0];
    screen.getByText(target.name);
    screen.getByText(`${target.address}:${target.port}`);

    const startupOptions = screen.getByRole("combobox", { name: "Startup" });
    expect(startupOptions).toHaveValue("onboot");
  });

  it("prioritizes config target properties over system target properties", async () => {
    mockParams({
      name: "iqn.2023-01.com.example:12ac588",
      address: "192.168.100.102",
      port: "3262",
    });

    const systemTarget = {
      name: "iqn.2023-01.com.example:12ac588",
      address: "192.168.100.102",
      port: 3262,
      interface: "default",
      startup: "onboot",
    };

    const configTarget = {
      name: "iqn.2023-01.com.example:12ac588",
      address: "192.168.100.102",
      port: 3262,
      startup: "manual",
    };

    mockUseSystemFn.mockReturnValue({ targets: [systemTarget] });
    mockUseConfigFn.mockReturnValue({ targets: [configTarget] });

    installerRender(<TargetLoginPage />, { withL10n: true });

    const startupOptions = screen.getByRole("combobox", { name: "Startup" });
    expect(startupOptions).toHaveValue("manual");
  });
});
