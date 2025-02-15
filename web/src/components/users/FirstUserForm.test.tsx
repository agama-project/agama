/*
 * Copyright (c) [2025] SUSE LLC
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
import FirstUserForm from "./FirstUserForm";

const mockFirstUser = jest.fn();
const mockFirstUserMutation = jest.fn().mockResolvedValue(true);

jest.mock("~/components/product/ProductRegistrationAlert", () => () => (
  <div>ProductRegistrationAlert Mock</div>
));

jest.mock("~/queries/users", () => ({
  ...jest.requireActual("~/queries/users"),
  useFirstUser: () => mockFirstUser(),
  useFirstUserMutation: () => ({
    mutateAsync: mockFirstUserMutation,
  }),
}));

describe("FirstUserForm", () => {
  describe("when user is not defined", () => {
    beforeEach(() => {
      mockFirstUser.mockReturnValue({ userName: "" });
    });

    it("renders the form in 'create' mode", () => {
      installerRender(<FirstUserForm />);

      screen.getByRole("heading", { name: "Create user" });
      screen.getByRole("textbox", { name: "Full name" });
      screen.getByRole("textbox", { name: "Username" });
      // NOTE: Password inputs don't have an implicit role, so they must be
      // queried using getByLabelText instead. See
      // https://github.com/testing-library/dom-testing-library/issues/567
      screen.getByLabelText("Password");
      screen.getByLabelText("Password confirmation");
      screen.getByRole("button", { name: "Accept" });
      screen.getByRole("link", { name: "Cancel" });

      expect(screen.queryByRole("switch", { name: "Edit password too" })).not.toBeInTheDocument();
    });

    it("allows defining the user when all data is provided", async () => {
      const { user } = installerRender(<FirstUserForm />);

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

      expect(mockFirstUserMutation).toHaveBeenCalledWith({
        fullName: "Gecko Migo",
        userName: "gmigo",
        password: "n0ts3cr3t",
        hashedPassword: false,
      });
    });

    it("does not requests to define the user when data is missing", async () => {
      const { user } = installerRender(<FirstUserForm />);

      const fullname = screen.getByRole("textbox", { name: "Full name" });
      const acceptButton = screen.getByRole("button", { name: "Accept" });
      await user.type(fullname, "Gecko Migo");
      await user.click(acceptButton);

      expect(mockFirstUserMutation).not.toHaveBeenCalled();
      screen.getByText("Warning alert:");
      screen.getByText("All fields are required");
    });

    it("renders errors from the server, if any", async () => {
      mockFirstUserMutation.mockRejectedValue(["Username not valid"]);
      const { user } = installerRender(<FirstUserForm />);

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
      mockFirstUser.mockReturnValue({ fullName: "Gecko Migo", userName: "gmigo", password: "" });
    });

    it("renders the form in 'edit' mode", () => {
      installerRender(<FirstUserForm />);

      screen.getByRole("heading", { name: "Edit user" });
      screen.getByRole("textbox", { name: "Full name" });
      screen.getByRole("textbox", { name: "Username" });
      screen.getByRole("switch", { name: "Edit password too" });
      expect(screen.queryByLabelText("Password")).not.toBeInTheDocument();
      expect(screen.queryByLabelText("Password confirmation")).not.toBeInTheDocument();
      screen.getByRole("button", { name: "Accept" });
      screen.getByRole("link", { name: "Cancel" });
    });

    it("allows editing user definition without changing the password", async () => {
      const { user } = installerRender(<FirstUserForm />);

      const fullname = screen.getByRole("textbox", { name: "Full name" });
      const username = screen.getByRole("textbox", { name: "Username" });
      const acceptButton = screen.getByRole("button", { name: "Accept" });
      await user.clear(fullname);
      await user.type(fullname, "Gecko Loco");
      await user.clear(username);
      await user.type(username, "gloco");
      await user.click(acceptButton);

      expect(mockFirstUserMutation).toHaveBeenCalledWith({
        fullName: "Gecko Loco",
        userName: "gloco",
        // FIXME: setting empty password really means not touching previous one?
        password: "",
      });
    });

    it("allows editing full user definition", async () => {
      const { user } = installerRender(<FirstUserForm />);

      const fullname = screen.getByRole("textbox", { name: "Full name" });
      const username = screen.getByRole("textbox", { name: "Username" });
      const editPasswordToggle = screen.queryByRole("switch", { name: "Edit password too" });
      const acceptButton = screen.getByRole("button", { name: "Accept" });
      await user.clear(fullname);
      await user.type(fullname, "Gecko Loco");
      await user.clear(username);
      await user.type(username, "gloco");
      await user.click(editPasswordToggle);
      const password = screen.getByLabelText("Password");
      const passwordConfirmation = screen.getByLabelText("Password confirmation");
      await user.clear(password);
      await user.type(password, "m0r3s3cr3t");
      await user.clear(passwordConfirmation);
      await user.type(passwordConfirmation, "m0r3s3cr3t");
      await user.click(acceptButton);

      expect(mockFirstUserMutation).toHaveBeenCalledWith({
        fullName: "Gecko Loco",
        userName: "gloco",
        password: "m0r3s3cr3t",
        hashedPassword: false,
      });
    });
  });
});
