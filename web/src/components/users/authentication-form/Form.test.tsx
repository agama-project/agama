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
import { screen, within } from "@testing-library/react";
import { installerRender } from "~/test-utils";
import type { User, Root } from "~/model/config";
import AuthenticationForm from "./Form";

let mockFirstUser: User.Config | undefined;
let mockRootUser: Root.Config | undefined;
const mockPutConfig = jest.fn().mockResolvedValue(true);

jest.mock("~/components/users/PasswordCheck", () => () => <div>PasswordCheck Mock</div>);

jest.mock("~/hooks/model/config", () => ({
  ...jest.requireActual("~/hooks/model/config"),
  useConfig: () => ({
    user: mockFirstUser,
    root: mockRootUser,
  }),
}));

jest.mock("~/api", () => ({
  ...jest.requireActual("~/api"),
  putConfig: (config) => mockPutConfig(config),
}));

describe("AuthenticationForm", () => {
  beforeEach(() => {
    mockFirstUser = undefined;
    mockRootUser = undefined;
    jest.clearAllMocks();
  });

  describe("initial render", () => {
    it("renders the form with authentication breadcrumb", () => {
      installerRender(<AuthenticationForm />);
      screen.getByText("Authentication");
    });

    it("renders first user and root fieldsets", () => {
      installerRender(<AuthenticationForm />);
      screen.getByText("First user");
      screen.getByText("Root");
    });

    it("renders first user checkbox unchecked by default", () => {
      installerRender(<AuthenticationForm />);
      const checkbox = screen.getByRole("checkbox", { name: /Define user account/i });
      expect(checkbox).not.toBeChecked();
    });

    it("shows root authentication mode selector", () => {
      installerRender(<AuthenticationForm />);
      const dropdown = screen.getByLabelText("Authentication mode");
      expect(dropdown).toHaveTextContent("None");
    });
  });

  describe("first user section", () => {
    it("hides first user fields when checkbox is unchecked", () => {
      installerRender(<AuthenticationForm />);
      expect(screen.queryByLabelText("Full name")).not.toBeInTheDocument();
      expect(screen.queryByLabelText("Username")).not.toBeInTheDocument();
    });

    it("reveals first user fields when checkbox is checked", async () => {
      const { user } = installerRender(<AuthenticationForm />);
      const checkbox = screen.getByRole("checkbox", { name: /Define user account/i });

      await user.click(checkbox);

      screen.getByLabelText("Full name");
      screen.getByLabelText("Username");
    });

    it("loads existing first user data", () => {
      mockFirstUser = {
        fullName: "Jane Doe",
        userName: "jdoe",
        hashedPassword: false,
      };

      installerRender(<AuthenticationForm />);

      const checkbox = screen.getByRole("checkbox", { name: /Define user account/i });
      expect(checkbox).toBeChecked();
      expect(screen.getByLabelText("Full name")).toHaveValue("Jane Doe");
      expect(screen.getByLabelText("Username")).toHaveValue("jdoe");
    });
  });

  describe("root authentication section", () => {
    it("loads root authentication mode from config", () => {
      mockRootUser = {
        password: "h4$h3d",
        hashedPassword: true,
      };

      installerRender(<AuthenticationForm />);

      const dropdown = screen.getByLabelText("Authentication mode");
      expect(dropdown).toHaveTextContent("Password");
    });

    it("loads SSH key mode from config", () => {
      mockRootUser = {
        sshPublicKeys: "ssh-rsa AAAAB3NzaC1yc2EAAAABIwAAAQEA root@host",
      };

      installerRender(<AuthenticationForm />);

      const dropdown = screen.getByLabelText("Authentication mode");
      expect(dropdown).toHaveTextContent("SSH Public Key");
    });

    it("loads both password and SSH key mode from config", () => {
      mockRootUser = {
        password: "h4$h3d",
        hashedPassword: true,
        sshPublicKeys: "ssh-rsa AAAAB3NzaC1yc2EAAAABIwAAAQEA root@host",
      };

      installerRender(<AuthenticationForm />);

      const dropdown = screen.getByLabelText("Authentication mode");
      expect(dropdown).toHaveTextContent("Both");
    });
  });

  describe("form submission", () => {
    it("shows no changes message when form is pristine", async () => {
      const { user } = installerRender(<AuthenticationForm />);
      const submitButton = screen.getByRole("button", { name: "Accept" });

      await user.click(submitButton);

      expect(mockPutConfig).not.toHaveBeenCalled();
      screen.getByText(/No changes detected/i);
    });

    it("creates first user when checkbox is checked", async () => {
      const { user } = installerRender(<AuthenticationForm />);
      const checkbox = screen.getByRole("checkbox", { name: /Define user account/i });

      await user.click(checkbox);
      await user.type(screen.getByLabelText("Full name"), "John Smith");
      await user.type(screen.getByLabelText("Username"), "jsmith");
      await user.type(screen.getByLabelText("Password"), "secret123");
      await user.type(screen.getByLabelText("Password confirmation"), "secret123");
      await user.click(screen.getByRole("button", { name: "Accept" }));

      expect(mockPutConfig).toHaveBeenCalledWith(
        expect.objectContaining({
          user: expect.objectContaining({
            fullName: "John Smith",
            userName: "jsmith",
            password: "secret123",
          }),
        }),
      );
    });

    it("removes first user when checkbox is unchecked", async () => {
      mockFirstUser = {
        fullName: "Jane Doe",
        userName: "jdoe",
        hashedPassword: false,
      };

      const { user } = installerRender(<AuthenticationForm />);
      const checkbox = screen.getByRole("checkbox", { name: /Define user account/i });

      await user.click(checkbox);
      await user.click(screen.getByRole("button", { name: "Accept" }));

      const callArg = mockPutConfig.mock.calls[0][0];
      expect(callArg).not.toHaveProperty("user");
    });

    it("preserves root when updating only first user", async () => {
      mockFirstUser = {
        fullName: "Jane Doe",
        userName: "jdoe",
        password: "userpass",
        hashedPassword: false,
      };
      mockRootUser = {
        password: "rootpass",
        hashedPassword: false,
      };

      const { user } = installerRender(<AuthenticationForm />);
      const fullNameInput = screen.getByLabelText("Full name");

      await user.clear(fullNameInput);
      await user.type(fullNameInput, "Jane Smith");
      await user.click(screen.getByRole("button", { name: "Accept" }));

      expect(mockPutConfig).toHaveBeenCalledWith(
        expect.objectContaining({
          user: expect.objectContaining({
            fullName: "Jane Smith",
            userName: "jdoe",
          }),
          root: expect.objectContaining({
            password: "rootpass",
          }),
        }),
      );
    });

    it("preserves first user when updating only root", async () => {
      mockFirstUser = {
        fullName: "Jane Doe",
        userName: "jdoe",
        password: "userpass",
        hashedPassword: false,
      };
      mockRootUser = {
        password: "oldpass",
        hashedPassword: false,
      };

      const { user } = installerRender(<AuthenticationForm />);

      const rootGroup = screen.getByRole("group", { name: "Root" });
      const passwordInput = within(rootGroup).getByLabelText("Password");
      const confirmationInput = within(rootGroup).getByLabelText("Password confirmation");

      await user.clear(passwordInput);
      await user.type(passwordInput, "newpass");
      await user.clear(confirmationInput);
      await user.type(confirmationInput, "newpass");
      await user.click(screen.getByRole("button", { name: "Accept" }));

      expect(mockPutConfig).toHaveBeenCalledWith(
        expect.objectContaining({
          user: expect.objectContaining({
            fullName: "Jane Doe",
            userName: "jdoe",
          }),
          root: expect.objectContaining({
            password: "newpass",
          }),
        }),
      );
    });
  });

  describe("validation", () => {
    it("validates first user fields when checkbox is checked", async () => {
      const { user } = installerRender(<AuthenticationForm />);
      const checkbox = screen.getByRole("checkbox", { name: /Define user account/i });

      await user.click(checkbox);
      await user.click(screen.getByRole("button", { name: "Accept" }));

      expect(mockPutConfig).not.toHaveBeenCalled();
      screen.getByText("Full name is required");
      screen.getByText("Username is required");
    });
  });

  describe("backend compatibility", () => {
    it("loads SSH key from sshPublicKey field (string)", () => {
      mockRootUser = {
        sshPublicKey: "ssh-rsa AAAAB3NzaC1yc2EAAAABIwAAAQEA root@host",
      };

      installerRender(<AuthenticationForm />);

      const dropdown = screen.getByLabelText("Authentication mode");
      expect(dropdown).toHaveTextContent("SSH Public Key");
    });

    it("loads SSH key from sshPublicKeys field (string)", () => {
      mockRootUser = {
        sshPublicKeys: "ssh-rsa AAAAB3NzaC1yc2EAAAABIwAAAQEA root@host",
      };

      installerRender(<AuthenticationForm />);

      const dropdown = screen.getByLabelText("Authentication mode");
      expect(dropdown).toHaveTextContent("SSH Public Key");
    });

    it("loads first user SSH key from sshPublicKey field (string)", () => {
      mockFirstUser = {
        fullName: "Jane Doe",
        userName: "jdoe",
        sshPublicKey: "ssh-rsa AAAAB3NzaC1yc2EAAAABIwAAAQEA user@host",
      };

      installerRender(<AuthenticationForm />);

      const checkbox = screen.getByRole("checkbox", { name: /Define user account/i });
      expect(checkbox).toBeChecked();
    });
  });

  describe("server errors", () => {
    it("displays error alert when API call fails", async () => {
      mockPutConfig.mockRejectedValueOnce({ message: "Network error" });

      const { user } = installerRender(<AuthenticationForm />);
      const checkbox = screen.getByRole("checkbox", { name: /Define user account/i });

      await user.click(checkbox);
      await user.type(screen.getByLabelText("Full name"), "John Smith");
      await user.type(screen.getByLabelText("Username"), "jsmith");
      await user.type(screen.getByLabelText("Password"), "secret123");
      await user.type(screen.getByLabelText("Password confirmation"), "secret123");
      await user.click(screen.getByRole("button", { name: "Accept" }));

      screen.getByText(/Authentication settings could not be updated/i);
      screen.getByText("Network error");
    });
  });

  describe("success feedback", () => {
    it("shows success message after successful submission", async () => {
      const { user } = installerRender(<AuthenticationForm />);
      const checkbox = screen.getByRole("checkbox", { name: /Define user account/i });

      await user.click(checkbox);
      await user.type(screen.getByLabelText("Full name"), "John Smith");
      await user.type(screen.getByLabelText("Username"), "jsmith");
      await user.type(screen.getByLabelText("Password"), "secret123");
      await user.type(screen.getByLabelText("Password confirmation"), "secret123");
      await user.click(screen.getByRole("button", { name: "Accept" }));

      await screen.findByText(/successfully updated/i);
    });
  });
});
