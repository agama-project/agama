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
import { installerRender } from "~/test-utils";
import FirstUserForm from "./Form";

let mockUser: { fullName?: string; userName?: string; password?: string; hashedPassword?: boolean };
const mockPatchConfig = jest.fn().mockResolvedValue(true);

jest.mock("~/components/users/PasswordCheck", () => () => <div>PasswordCheck Mock</div>);

jest.mock("~/hooks/model/config", () => ({
  ...jest.requireActual("~/hooks/model/config"),
  useConfig: () => ({
    user: mockUser,
  }),
}));

jest.mock("~/api", () => ({
  ...jest.requireActual("~/api"),
  patchConfig: (config) => mockPatchConfig(config),
}));

describe("FirstUserForm", () => {
  beforeEach(() => {
    mockUser = undefined;
    jest.clearAllMocks();
  });

  describe("create mode", () => {
    it("renders an empty form", () => {
      installerRender(<FirstUserForm />);
      expect(screen.getByLabelText("Full name")).toHaveValue("");
      expect(screen.getByLabelText("Username")).toHaveValue("");
      expect(screen.getByLabelText("Password")).toHaveValue("");
      expect(screen.getByLabelText("Password confirmation")).toHaveValue("");
    });

    it("shows correct breadcrumb", () => {
      installerRender(<FirstUserForm />);
      screen.getByText("Create user");
    });
  });

  describe("edit mode", () => {
    beforeEach(() => {
      mockUser = {
        fullName: "Jane Doe",
        userName: "jdoe",
        hashedPassword: false,
      };
    });

    it("loads existing user data", () => {
      installerRender(<FirstUserForm />);
      expect(screen.getByLabelText("Full name")).toHaveValue("Jane Doe");
      expect(screen.getByLabelText("Username")).toHaveValue("jdoe");
    });

    it("shows correct breadcrumb", () => {
      installerRender(<FirstUserForm />);
      screen.getByText("Edit user");
    });
  });

  describe("username suggestions", () => {
    it("provides datalist for username autocomplete", () => {
      installerRender(<FirstUserForm />);
      const usernameInput = screen.getByLabelText("Username") as HTMLInputElement;
      const datalist = document.getElementById("userName-datalist");

      expect(datalist).toBeInTheDocument();
      expect(usernameInput.getAttribute("list")).toBe("userName-datalist");
    });

    it("generates username suggestions when fullName is blurred", async () => {
      const { user } = installerRender(<FirstUserForm />);
      const fullNameInput = screen.getByLabelText("Full name");
      const datalist = document.getElementById("userName-datalist");

      expect(datalist?.querySelectorAll("option")).toHaveLength(0);

      await user.type(fullNameInput, "John Smith");
      await user.tab();

      const options = datalist?.querySelectorAll("option");
      expect(options!.length).toBeGreaterThan(0);
      const values = Array.from(options!).map((opt) => opt.value);
      expect(values).toContain("john");
      expect(values).toContain("jsmith");
    });
  });

  describe("validation", () => {
    it("requires full name", async () => {
      const { user } = installerRender(<FirstUserForm />);
      const submitButton = screen.getByRole("button", { name: "Accept" });

      await user.click(submitButton);

      expect(mockPatchConfig).not.toHaveBeenCalled();
      screen.getByText("Full name is required");
    });

    it("requires username", async () => {
      const { user } = installerRender(<FirstUserForm />);
      const fullNameInput = screen.getByLabelText("Full name");
      const submitButton = screen.getByRole("button", { name: "Accept" });

      await user.type(fullNameInput, "John Doe");
      await user.click(submitButton);

      expect(mockPatchConfig).not.toHaveBeenCalled();
      screen.getByText("Username is required");
    });

    it("requires password when not using hashed password", async () => {
      const { user } = installerRender(<FirstUserForm />);
      const fullNameInput = screen.getByLabelText("Full name");
      const usernameInput = screen.getByLabelText("Username");
      const submitButton = screen.getByRole("button", { name: "Accept" });

      await user.type(fullNameInput, "John Doe");
      await user.type(usernameInput, "jdoe");
      await user.click(submitButton);

      expect(mockPatchConfig).not.toHaveBeenCalled();
      screen.getByText("Password is required");
    });

    it("requires password confirmation when not using hashed password", async () => {
      const { user } = installerRender(<FirstUserForm />);
      const fullNameInput = screen.getByLabelText("Full name");
      const usernameInput = screen.getByLabelText("Username");
      const passwordInput = screen.getByLabelText("Password");
      const submitButton = screen.getByRole("button", { name: "Accept" });

      await user.type(fullNameInput, "John Doe");
      await user.type(usernameInput, "jdoe");
      await user.type(passwordInput, "secret123");
      await user.click(submitButton);

      expect(mockPatchConfig).not.toHaveBeenCalled();
      screen.getByText("Password confirmation is required");
    });

    it("validates that passwords match", async () => {
      const { user } = installerRender(<FirstUserForm />);
      const fullNameInput = screen.getByLabelText("Full name");
      const usernameInput = screen.getByLabelText("Username");
      const passwordInput = screen.getByLabelText("Password");
      const passwordConfirmationInput = screen.getByLabelText("Password confirmation");
      const submitButton = screen.getByRole("button", { name: "Accept" });

      await user.type(fullNameInput, "John Doe");
      await user.type(usernameInput, "jdoe");
      await user.type(passwordInput, "secret123");
      await user.type(passwordConfirmationInput, "different456");
      await user.click(submitButton);

      expect(mockPatchConfig).not.toHaveBeenCalled();
      screen.getByText("Passwords do not match");
    });
  });

  describe("hashed password mode", () => {
    beforeEach(() => {
      mockUser = {
        fullName: "Jane Doe",
        userName: "jdoe",
        password: "h4$h3dP@$$",
        hashedPassword: true,
      };
    });

    it("shows preserved message when using hashed password", () => {
      installerRender(<FirstUserForm />);
      screen.getByText("Using a hashed password.");
      expect(screen.queryByLabelText("Password")).not.toBeInTheDocument();
      expect(screen.queryByLabelText("Password confirmation")).not.toBeInTheDocument();
    });

    it("shows change button to switch to plain password", () => {
      installerRender(<FirstUserForm />);
      screen.getByRole("button", { name: "Change" });
    });

    it("reveals password fields when clicking change button", async () => {
      const { user } = installerRender(<FirstUserForm />);
      const changeButton = screen.getByRole("button", { name: "Change" });

      await user.click(changeButton);

      screen.getByLabelText("Password");
      screen.getByLabelText("Password confirmation");
      expect(screen.queryByText("Using a hashed password.")).not.toBeInTheDocument();
    });

    it("preserves hashed password when submitting without changes", async () => {
      const { user } = installerRender(<FirstUserForm />);
      const submitButton = screen.getByRole("button", { name: "Accept" });

      await user.click(submitButton);

      expect(mockPatchConfig).toHaveBeenCalledWith(
        expect.objectContaining({
          user: {
            fullName: "Jane Doe",
            userName: "jdoe",
            password: "h4$h3dP@$$",
            hashedPassword: true,
          },
        }),
      );
    });

    it("allows switching to plain password and submitting", async () => {
      const { user } = installerRender(<FirstUserForm />);
      const changeButton = screen.getByRole("button", { name: "Change" });
      const submitButton = screen.getByRole("button", { name: "Accept" });

      await user.click(changeButton);

      const passwordInput = screen.getByLabelText("Password");
      const passwordConfirmationInput = screen.getByLabelText("Password confirmation");

      await user.type(passwordInput, "newPassword123");
      await user.type(passwordConfirmationInput, "newPassword123");
      await user.click(submitButton);

      expect(mockPatchConfig).toHaveBeenCalledWith(
        expect.objectContaining({
          user: {
            fullName: "Jane Doe",
            userName: "jdoe",
            password: "newPassword123",
            hashedPassword: false,
          },
        }),
      );
    });
  });

  describe("PasswordCheck integration", () => {
    it("displays PasswordCheck component when password fields are visible", () => {
      installerRender(<FirstUserForm />);
      screen.getByText("PasswordCheck Mock");
    });

    it("does not display PasswordCheck when using hashed password", () => {
      mockUser = {
        fullName: "Jane Doe",
        userName: "jdoe",
        password: "h4$h3dP@$$",
        hashedPassword: true,
      };

      installerRender(<FirstUserForm />);
      expect(screen.queryByText("PasswordCheck Mock")).not.toBeInTheDocument();
    });
  });

  describe("successful submission", () => {
    it("calls patchConfig with correct payload for new user", async () => {
      const { user } = installerRender(<FirstUserForm />);
      const fullNameInput = screen.getByLabelText("Full name");
      const usernameInput = screen.getByLabelText("Username");
      const passwordInput = screen.getByLabelText("Password");
      const passwordConfirmationInput = screen.getByLabelText("Password confirmation");
      const submitButton = screen.getByRole("button", { name: "Accept" });

      await user.type(fullNameInput, "John Smith");
      await user.type(usernameInput, "jsmith");
      await user.type(passwordInput, "mySecret123");
      await user.type(passwordConfirmationInput, "mySecret123");
      await user.click(submitButton);

      expect(mockPatchConfig).toHaveBeenCalledWith({
        user: {
          fullName: "John Smith",
          userName: "jsmith",
          password: "mySecret123",
          hashedPassword: false,
        },
      });
    });

    it("calls patchConfig with correct payload when editing user", async () => {
      mockUser = {
        fullName: "Jane Doe",
        userName: "jdoe",
        hashedPassword: false,
      };

      const { user } = installerRender(<FirstUserForm />);
      const fullNameInput = screen.getByLabelText("Full name");
      const submitButton = screen.getByRole("button", { name: "Accept" });

      await user.clear(fullNameInput);
      await user.type(fullNameInput, "Jane Smith");

      const passwordInput = screen.getByLabelText("Password");
      const passwordConfirmationInput = screen.getByLabelText("Password confirmation");
      await user.type(passwordInput, "newSecret123");
      await user.type(passwordConfirmationInput, "newSecret123");

      await user.click(submitButton);

      expect(mockPatchConfig).toHaveBeenCalledWith({
        user: {
          fullName: "Jane Smith",
          userName: "jdoe",
          password: "newSecret123",
          hashedPassword: false,
        },
      });
    });
  });

  describe("server error", () => {
    it("displays error alert when API call fails", async () => {
      mockPatchConfig.mockRejectedValueOnce(new Error("Network error"));

      const { user } = installerRender(<FirstUserForm />);
      const fullNameInput = screen.getByLabelText("Full name");
      const usernameInput = screen.getByLabelText("Username");
      const passwordInput = screen.getByLabelText("Password");
      const passwordConfirmationInput = screen.getByLabelText("Password confirmation");
      const submitButton = screen.getByRole("button", { name: "Accept" });

      await user.type(fullNameInput, "John Smith");
      await user.type(usernameInput, "jsmith");
      await user.type(passwordInput, "mySecret123");
      await user.type(passwordConfirmationInput, "mySecret123");
      await user.click(submitButton);

      screen.getByText("Something went wrong");
      screen.getByText("Network error");
      expect(mockPatchConfig).toHaveBeenCalled();
    });
  });
});
