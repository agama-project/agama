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

import React, { act } from "react";
import { screen, within } from "@testing-library/react";
import { installerRender } from "~/test-utils";
import FirstUserForm from "./FirstUserForm";

let mockFullName: string;
let mockUserName: string;
let mockPassword: string;
let mockHashedPassword: boolean;
const mockPatchConfig = jest.fn().mockResolvedValue(true);

jest.mock("~/hooks/model/config", () => ({
  ...jest.requireActual("~/hooks/model/config"),
  useConfig: () => ({
    user: {
      userName: mockUserName,
      fullName: mockFullName,
      password: mockPassword,
      hashedPassword: mockHashedPassword,
    },
  }),
}));

jest.mock("~/api", () => ({
  ...jest.requireActual("~/api"),
  patchConfig: (config) => mockPatchConfig(config),
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

describe("FirstUserForm", () => {
  it("allows using suggested username", async () => {
    const { user } = installerRender(<FirstUserForm />, { withL10n: true });
    const fullNameInput = screen.getByRole("textbox", { name: "Full name" });
    const userNameInput = screen.getByRole("textbox", { name: "Username" });
    await user.type(fullNameInput, "Gecko Giggles");
    // Suggestions rely on blur/focus,
    // See https://testing-library.com/docs/guide-events#focusblur
    act(() => {
      fullNameInput.blur();
    });
    act(() => {
      userNameInput.focus();
    });
    const suggestions = screen.getByRole("menu");
    const secondSuggestion = within(suggestions).getByRole("menuitem", { name: /ggiggles$/ });
    await user.click(secondSuggestion);
    expect(userNameInput).toHaveValue("ggiggles");
  });

  describe("when user is not defined", () => {
    beforeEach(() => {
      mockUserName = "";
      mockFullName = "";
      mockPassword = "";
      mockHashedPassword = false;
    });

    it("renders the form in 'create' mode", () => {
      installerRender(<FirstUserForm />, { withL10n: true });

      screen.getByText("Create user");
      screen.getByRole("textbox", { name: "Full name" });
      screen.getByRole("textbox", { name: "Username" });
      // NOTE: Password inputs don't have an implicit role, so they must be
      // queried using getByLabelText instead. See
      // https://github.com/testing-library/dom-testing-library/issues/567
      screen.getByLabelText("Password");
      screen.getByLabelText("Password confirmation");
      screen.getByRole("button", { name: "Accept" });
      screen.getByRole("link", { name: "Cancel" });
    });

    it("allows defining the user when all data is provided", async () => {
      const { user } = installerRender(<FirstUserForm />, { withL10n: true });

      const fullname = screen.getByRole("textbox", { name: "Full name" });
      const username = screen.getByRole("textbox", { name: "Username" });
      const password = screen.getByLabelText("Password");
      const passwordConfirmation = screen.getByLabelText("Password confirmation");
      const acceptButton = screen.getByRole("button", { name: "Accept" });
      await user.type(fullname, "Gecko Migo");
      await user.type(username, "gmigo");
      await user.type(password, "n0ts3cr3t");
      await user.type(passwordConfirmation, "n0ts3cr3t");
      await user.click(acceptButton);

      expect(mockPatchConfig).toHaveBeenCalledWith(
        expect.objectContaining({
          user: expect.objectContaining({
            fullName: "Gecko Migo",
            userName: "gmigo",
            password: "n0ts3cr3t",
            hashedPassword: false,
          }),
        }),
      );
    });

    it("warning about missing data", async () => {
      const { user } = installerRender(<FirstUserForm />, { withL10n: true });

      const fullname = screen.getByRole("textbox", { name: "Full name" });
      const acceptButton = screen.getByRole("button", { name: "Accept" });
      await user.type(fullname, "Gecko Migo");
      await user.click(acceptButton);

      expect(mockPatchConfig).not.toHaveBeenCalled();
      screen.getByText("Warning alert:");
      screen.getByText("All fields are required");
    });

    it("renders errors from the server, if any", async () => {
      mockPatchConfig.mockRejectedValue({ response: { data: "Username not valid" } });
      const { user } = installerRender(<FirstUserForm />, { withL10n: true });

      const fullname = screen.getByRole("textbox", { name: "Full name" });
      const username = screen.getByRole("textbox", { name: "Username" });
      const password = screen.getByLabelText("Password");
      const passwordConfirmation = screen.getByLabelText("Password confirmation");
      const acceptButton = screen.getByRole("button", { name: "Accept" });
      await user.type(fullname, "Gecko Migo");
      await user.type(username, "gmigo");
      await user.type(password, "n0ts3cr3t");
      await user.type(passwordConfirmation, "n0ts3cr3t");
      await user.click(acceptButton);

      screen.getByText("Warning alert:");
      screen.getByText("Something went wrong");
      screen.getByText("Username not valid");
    });
  });

  describe("when user is defined", () => {
    beforeEach(() => {
      mockFullName = "Gecko Migo";
      mockUserName = "gmigo";
      mockPassword = "n0ts3cr3t";
      mockHashedPassword = false;
    });

    it("renders the form in 'edit' mode", () => {
      installerRender(<FirstUserForm />, { withL10n: true });

      screen.getByText("Edit user");
      const fullNameInput = screen.getByRole("textbox", { name: "Full name" });
      expect(fullNameInput).toHaveValue("Gecko Migo");
      const userNameInput = screen.getByRole("textbox", { name: "Username" });
      expect(userNameInput).toHaveValue("gmigo");
      const passwordInput = screen.queryByLabelText("Password");
      expect(passwordInput).toHaveValue("n0ts3cr3t");
      const passwordConfirmationInput = screen.queryByLabelText("Password confirmation");
      expect(passwordConfirmationInput).toHaveValue("n0ts3cr3t");
      screen.getByRole("button", { name: "Accept" });
      screen.getByRole("link", { name: "Cancel" });
    });

    it("allows editing user definition without changing the password", async () => {
      const { user } = installerRender(<FirstUserForm />, { withL10n: true });

      const fullname = screen.getByRole("textbox", { name: "Full name" });
      const username = screen.getByRole("textbox", { name: "Username" });
      const acceptButton = screen.getByRole("button", { name: "Accept" });
      await user.clear(fullname);
      await user.type(fullname, "Gecko Loco");
      await user.clear(username);
      await user.type(username, "gloco");
      await user.click(acceptButton);

      expect(mockPatchConfig).toHaveBeenCalledWith(
        expect.objectContaining({
          user: expect.objectContaining({
            fullName: "Gecko Loco",
            userName: "gloco",
          }),
        }),
      );
    });

    it("allows editing full user definition", async () => {
      const { user } = installerRender(<FirstUserForm />, { withL10n: true });

      const fullname = screen.getByRole("textbox", { name: "Full name" });
      const username = screen.getByRole("textbox", { name: "Username" });
      const acceptButton = screen.getByRole("button", { name: "Accept" });
      await user.clear(fullname);
      await user.type(fullname, "Gecko Loco");
      await user.clear(username);
      await user.type(username, "gloco");
      const password = screen.getByLabelText("Password");
      const passwordConfirmation = screen.getByLabelText("Password confirmation");
      await user.clear(password);
      await user.type(password, "m0r3s3cr3t");
      await user.clear(passwordConfirmation);
      await user.type(passwordConfirmation, "m0r3s3cr3t");
      await user.click(acceptButton);

      expect(mockPatchConfig).toHaveBeenCalledWith(
        expect.objectContaining({
          user: expect.objectContaining({
            fullName: "Gecko Loco",
            userName: "gloco",
            password: "m0r3s3cr3t",
            hashedPassword: false,
          }),
        }),
      );
    });

    describe("and a hashed password is set", () => {
      beforeEach(() => {
        mockPassword = "s3cr3th4$h";
        mockHashedPassword = true;
      });

      it("allows preserving it", async () => {
        const { user } = installerRender(<FirstUserForm />, { withL10n: true });
        const acceptButton = screen.getByRole("button", { name: "Accept" });
        screen.getByText("Using a hashed password.");
        await user.click(acceptButton);
        expect(mockPatchConfig).toHaveBeenCalledWith(
          expect.objectContaining({
            user: expect.not.objectContaining({ hashedPassword: false }),
          }),
        );
      });

      it("allows using a plain password instead", async () => {
        const { user } = installerRender(<FirstUserForm />, { withL10n: true });
        const acceptButton = screen.getByRole("button", { name: "Accept" });
        screen.getByText("Using a hashed password.");
        expect(screen.queryByText(mockPassword)).not.toBeInTheDocument();
        const changeToPlainButton = screen.getByRole("button", { name: "Change" });
        await user.click(changeToPlainButton);
        const passwordInput = screen.getByLabelText("Password");
        expect(passwordInput).not.toHaveValue(mockPassword);
        const passwordConfirmationInput = screen.getByLabelText("Password confirmation");
        expect(passwordConfirmationInput).not.toHaveValue(mockPassword);
        await user.type(passwordInput, "n0tS3cr3t");
        await user.type(passwordConfirmationInput, "n0tS3cr3t");
        await user.click(acceptButton);
        expect(mockPatchConfig).toHaveBeenCalledWith(
          expect.objectContaining({
            user: expect.objectContaining({ hashedPassword: false, password: "n0tS3cr3t" }),
          }),
        );
      });
    });
  });
});
