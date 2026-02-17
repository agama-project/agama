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
import { installerRender, mockNavigateFn } from "~/test-utils";
import { STORAGE } from "~/routes/paths";
import DiscoverFormPage from "./DiscoverFormPage";

const mockDiscoverISCSIAction = jest.fn();
const mockScrollIntoViewFn = jest.fn();

jest.mock("~/api", () => ({
  ...jest.requireActual("~/api"),
  discoverISCSIAction: (...args) => mockDiscoverISCSIAction(...args),
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

describe("DiscoverFormPage", () => {
  beforeEach(() => {
    // .scrollIntoView is not yet implemented at jsdom, https://github.com/jsdom/jsdom/issues/1695
    window.HTMLElement.prototype.scrollIntoView = mockScrollIntoViewFn;
  });

  it("allows discovering without authentication", async () => {
    const { user } = installerRender(<DiscoverFormPage />, { withL10n: true });

    const addressInput = screen.getByRole("textbox", { name: "Address" });
    const portInput = screen.getByRole("textbox", { name: "Port" });
    const acceptButton = screen.getByRole("button", { name: "Accept" });

    await user.type(addressInput, "192.168.100.102");
    await user.clear(portInput);
    await user.type(portInput, "3260");
    await user.click(acceptButton);

    expect(mockDiscoverISCSIAction).toHaveBeenCalledWith({
      address: "192.168.100.102",
      port: 3260,
    });
    expect(mockNavigateFn).toHaveBeenCalledWith({ pathname: STORAGE.iscsi.root });
  });

  it("allows discovering with authentication", async () => {
    const { user } = installerRender(<DiscoverFormPage />, { withL10n: true });

    const addressInput = screen.getByRole("textbox", { name: "Address" });
    const portInput = screen.getByRole("textbox", { name: "Port" });
    const authSwitch = screen.getByRole("switch", { name: "Provide authentication" });
    const acceptButton = screen.getByRole("button", { name: "Accept" });

    await user.type(addressInput, "192.168.100.102");
    await user.clear(portInput);
    await user.type(portInput, "3260");
    await user.click(authSwitch);

    const username = screen.getByRole("textbox", { name: "User name" });
    const password = screen.getByLabelText("Password");

    await user.type(username, "john");
    await user.type(password, "secret");
    await user.click(acceptButton);

    expect(mockDiscoverISCSIAction).toHaveBeenCalledWith({
      address: "192.168.100.102",
      port: 3260,
      username: "john",
      password: "secret",
    });
    expect(mockNavigateFn).toHaveBeenCalledWith({ pathname: STORAGE.iscsi.root });
  });

  it("allows discovering with mutual authentication", async () => {
    const { user } = installerRender(<DiscoverFormPage />, { withL10n: true });

    const addressInput = screen.getByRole("textbox", { name: "Address" });
    const portInput = screen.getByRole("textbox", { name: "Port" });
    const authSwitch = screen.getByRole("switch", { name: "Provide authentication" });
    const acceptButton = screen.getByRole("button", { name: "Accept" });

    await user.type(addressInput, "192.168.100.102");
    await user.clear(portInput);
    await user.type(portInput, "3260");
    await user.click(authSwitch);

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

    expect(mockDiscoverISCSIAction).toHaveBeenCalledWith({
      address: "192.168.100.102",
      port: 3260,
      username: "john",
      password: "secret",
      initiatorUsername: "jane",
      initiatorPassword: "secret",
    });
    expect(mockNavigateFn).toHaveBeenCalledWith({ pathname: STORAGE.iscsi.root });
  });

  it("shows validation errors for invalid IP address", async () => {
    const { user } = installerRender(<DiscoverFormPage />, { withL10n: true });

    const addressInput = screen.getByRole("textbox", { name: "Address" });
    const acceptButton = screen.getByRole("button", { name: "Accept" });

    await user.type(addressInput, "invalid-ip");
    await user.click(acceptButton);

    screen.getByText("No valid address.");
    expect(mockScrollIntoViewFn).toHaveBeenCalled();
    expect(mockDiscoverISCSIAction).not.toHaveBeenCalled();
    expect(mockNavigateFn).not.toHaveBeenCalled();
  });

  it("shows validation errors for missing required fields", async () => {
    const { user } = installerRender(<DiscoverFormPage />, { withL10n: true });

    const authSwitch = screen.getByRole("switch", { name: "Provide authentication" });
    const acceptButton = screen.getByRole("button", { name: "Accept" });

    await user.click(authSwitch);
    await user.click(acceptButton);

    screen.getByText("All fields are required.");
    expect(mockScrollIntoViewFn).toHaveBeenCalled();
    expect(mockDiscoverISCSIAction).not.toHaveBeenCalled();
    expect(mockNavigateFn).not.toHaveBeenCalled();
  });
});
