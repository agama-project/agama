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
import { shake } from "radashi";
import { installerRender } from "~/test-utils";
import type { User, Root } from "~/model/config";
import AuthenticationForm from "./Form";

let mockFirstUser: User.Config | undefined;
let mockRootUser: Root.Config | undefined;
const mockPutConfig = jest.fn().mockResolvedValue(true);
const mockUpdateConfig = jest.fn((patch) =>
  mockPutConfig(
    shake({
      user: mockFirstUser,
      root: mockRootUser,
      ...patch,
    }),
  ),
);

jest.mock("~/components/users/PasswordCheck", () => () => <div>PasswordCheck Mock</div>);

jest.mock("~/hooks/model/config", () => ({
  ...jest.requireActual("~/hooks/model/config"),
  useConfig: () => ({
    user: mockFirstUser,
    root: mockRootUser,
  }),
  useUpdateConfig: () => mockUpdateConfig,
}));

jest.mock("~/api", () => ({
  ...jest.requireActual("~/api"),
  putConfig: (config) => mockPutConfig(config),
}));

/** Checks the "Define an administrator user" checkbox and returns it. */
const enableFirstUser = async (user: ReturnType<typeof installerRender>["user"]) => {
  const checkbox = screen.getByRole("checkbox", { name: /Define an administrator user/i });
  await user.click(checkbox);
  return checkbox;
};

/** Fills in the minimum valid first-user fields. */
const fillFirstUserFields = async (
  user: ReturnType<typeof installerRender>["user"],
  overrides: { fullName?: string; userName?: string; password?: string } = {},
) => {
  const { fullName = "John Smith", userName = "jsmith", password = "secret123" } = overrides;
  await user.type(screen.getByLabelText("Full name"), fullName);
  await user.type(screen.getByLabelText("Username"), userName);
  await user.type(screen.getByLabelText("Password"), password);
  await user.type(screen.getByLabelText("Password confirmation"), password);
};

describe("AuthenticationForm", () => {
  beforeEach(() => {
    mockFirstUser = undefined;
    mockRootUser = undefined;
    jest.clearAllMocks();
  });

  describe("initial render", () => {
    it("renders first user and root fieldsets", () => {
      installerRender(<AuthenticationForm />);
      screen.getByRole("group", { name: "Administrator account" });
      screen.getByRole("group", { name: "Root account" });
    });

    it("renders first user checkbox unchecked by default", () => {
      installerRender(<AuthenticationForm />);
      const checkbox = screen.getByRole("checkbox", { name: /Define an administrator user/i });
      expect(checkbox).not.toBeChecked();
    });

    it("shows root authentication mode selector defaulting to Disabled", () => {
      installerRender(<AuthenticationForm />);
      const dropdown = screen.getByLabelText("Root login method");
      expect(dropdown).toHaveTextContent("Disabled");
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
      await enableFirstUser(user);

      screen.getByLabelText("Full name");
      screen.getByLabelText("Username");
      screen.getByLabelText("Password");
      screen.getByLabelText("Password confirmation");
      screen.getByLabelText("SSH Public Keys (optional)");
    });

    it("loads existing first user data", () => {
      mockFirstUser = {
        fullName: "Jane Doe",
        userName: "jdoe",
        password: "s3cr3t",
        hashedPassword: false,
      };

      installerRender(<AuthenticationForm />);

      const checkbox = screen.getByRole("checkbox", { name: /Define an administrator user/i });
      expect(checkbox).toBeChecked();
      expect(screen.getByLabelText("Full name")).toHaveValue("Jane Doe");
      expect(screen.getByLabelText("Username")).toHaveValue("jdoe");
      expect(screen.getByLabelText("Password")).toHaveValue("s3cr3t");
      expect(screen.getByLabelText("Password confirmation")).toHaveValue("s3cr3t");
    });
  });

  describe("root authentication section", () => {
    it.each<[string, Root.Config, string]>([
      ["password only", { password: "h4$h3d", hashedPassword: true }, "Password"],
      [
        "SSH key only",
        { sshPublicKeys: "ssh-rsa AAAAB3NzaC1yc2EAAAABIwAAAQEA root@host" },
        "SSH Public Key",
      ],
      [
        "both password and SSH key",
        {
          password: "h4$h3d",
          hashedPassword: true,
          sshPublicKeys: "ssh-rsa AAAAB3NzaC1yc2EAAAABIwAAAQEA root@host",
        },
        "Password and SSH Public Key",
      ],
    ])("loads auth mode %s from config", (_label, rootConfig, expectedMode) => {
      mockRootUser = rootConfig;
      installerRender(<AuthenticationForm />);
      expect(screen.getByLabelText("Root login method")).toHaveTextContent(expectedMode);
    });
  });

  describe("form submission", () => {
    it("shows no changes message when form is pristine", async () => {
      const { user } = installerRender(<AuthenticationForm />);
      await user.click(screen.getByRole("button", { name: "Accept" }));

      expect(mockPutConfig).not.toHaveBeenCalled();
      screen.getByText("No changes to apply");
      const link = screen.getByRole("link", { name: "installation" });
      expect(link).toHaveAttribute("href", "/overview");
    });

    it("creates first user when checkbox is checked", async () => {
      const { user } = installerRender(<AuthenticationForm />);
      await enableFirstUser(user);
      await fillFirstUserFields(user);
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
        password: "s3cr3t",
        hashedPassword: false,
      };

      const { user } = installerRender(<AuthenticationForm />);
      await enableFirstUser(user);
      await user.click(screen.getByRole("button", { name: "Accept" }));

      expect(mockPutConfig.mock.calls[0][0]).not.toHaveProperty("user");
    });

    it("preserves root when updating only first user", async () => {
      mockFirstUser = {
        fullName: "Jane Doe",
        userName: "jdoe",
        password: "userpass",
        hashedPassword: false,
      };
      mockRootUser = { password: "rootpass", hashedPassword: false };

      const { user } = installerRender(<AuthenticationForm />);
      const fullNameInput = screen.getByLabelText("Full name");
      await user.clear(fullNameInput);
      await user.type(fullNameInput, "Jane Smith");
      await user.click(screen.getByRole("button", { name: "Accept" }));

      expect(mockPutConfig).toHaveBeenCalledWith(
        expect.objectContaining({
          user: expect.objectContaining({ fullName: "Jane Smith", userName: "jdoe" }),
          root: expect.objectContaining({ password: "rootpass" }),
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
      mockRootUser = { password: "oldpass", hashedPassword: false };

      const { user } = installerRender(<AuthenticationForm />);

      const rootGroup = screen.getByRole("group", { name: "Root account" });
      const passwordInput = within(rootGroup).getByLabelText("Password");
      const confirmationInput = within(rootGroup).getByLabelText("Password confirmation");

      await user.clear(passwordInput);
      await user.type(passwordInput, "newpass");
      await user.clear(confirmationInput);
      await user.type(confirmationInput, "newpass");
      await user.click(screen.getByRole("button", { name: "Accept" }));

      expect(mockPutConfig).toHaveBeenCalledWith(
        expect.objectContaining({
          user: expect.objectContaining({ fullName: "Jane Doe", userName: "jdoe" }),
          root: expect.objectContaining({ password: "newpass" }),
        }),
      );
    });
  });

  describe("validation", () => {
    it("validates first user fields when checkbox is checked", async () => {
      const { user } = installerRender(<AuthenticationForm />);
      await enableFirstUser(user);
      await user.click(screen.getByRole("button", { name: "Accept" }));

      expect(mockPutConfig).not.toHaveBeenCalled();
      screen.getByText("Full name is required");
      screen.getByText("Username is required");
    });

    it("accepts valid SSH public keys for first user", async () => {
      const { user } = installerRender(<AuthenticationForm />);
      await enableFirstUser(user);
      await fillFirstUserFields(user);

      const sshKeysField = screen.getByLabelText("SSH Public Keys (optional)");
      await user.type(sshKeysField, "ssh-rsa AAAAB3NzaC1yc2EAAAABIwAAAQEA user@host");
      await user.keyboard("{Enter}");

      await user.click(screen.getByRole("button", { name: "Accept" }));

      expect(mockPutConfig).toHaveBeenCalledWith(
        expect.objectContaining({
          user: expect.objectContaining({
            sshPublicKeys: ["ssh-rsa AAAAB3NzaC1yc2EAAAABIwAAAQEA user@host"],
          }),
        }),
      );
    });

    it("rejects invalid SSH public keys for first user", async () => {
      mockFirstUser = {
        fullName: "Jane Doe",
        userName: "jdoe",
        password: "s3cr3t",
        hashedPassword: false,
        sshPublicKeys: "not-a-valid-ssh-key",
      };

      const { user } = installerRender(<AuthenticationForm />);

      const fullNameInput = screen.getByLabelText("Full name");
      await user.type(fullNameInput, " Smith");

      await user.click(screen.getByRole("button", { name: "Accept" }));

      expect(mockPutConfig).not.toHaveBeenCalled();
      screen.getByText(/Invalid SSH Key/);
    });

    it("rejects private keys for first user", async () => {
      mockFirstUser = {
        fullName: "Jane Doe",
        userName: "jdoe",
        password: "s3cr3t",
        hashedPassword: false,
        sshPublicKeys: "-----BEGIN RSA PRIVATE KEY-----\nMIIEpAIBAAKCAQEA",
      };

      const { user } = installerRender(<AuthenticationForm />);

      const fullNameInput = screen.getByLabelText("Full name");
      await user.type(fullNameInput, " Smith");

      await user.click(screen.getByRole("button", { name: "Accept" }));

      expect(mockPutConfig).not.toHaveBeenCalled();
      screen.getByText(/Invalid SSH Key/);
    });
  });

  describe("backend compatibility", () => {
    it.each<[string, Root.Config | User.Config, "root" | "user"]>([
      [
        "root sshPublicKey (singular)",
        { sshPublicKey: "ssh-rsa AAAAB3NzaC1yc2EAAAABIwAAAQEA root@host" },
        "root",
      ],
      [
        "root sshPublicKeys (plural)",
        { sshPublicKeys: "ssh-rsa AAAAB3NzaC1yc2EAAAABIwAAAQEA root@host" },
        "root",
      ],
    ])("reads SSH key from %s field", (_label, config, target) => {
      if (target === "root") mockRootUser = config as Root.Config;
      installerRender(<AuthenticationForm />);
      expect(screen.getByLabelText("Root login method")).toHaveTextContent("SSH Public Key");
    });

    it("loads first user SSH key from sshPublicKey field (singular)", () => {
      mockFirstUser = {
        fullName: "Jane Doe",
        userName: "jdoe",
        password: "s3cr3t",
        sshPublicKey: "ssh-rsa AAAAB3NzaC1yc2EAAAABIwAAAQEA user@host",
      };

      installerRender(<AuthenticationForm />);

      expect(screen.getByRole("checkbox", { name: /Define an administrator user/i })).toBeChecked();
    });
  });

  describe("server errors", () => {
    it("displays error alert when API call fails", async () => {
      mockPutConfig.mockRejectedValueOnce({ message: "Network error" });

      const { user } = installerRender(<AuthenticationForm />);
      await enableFirstUser(user);
      await fillFirstUserFields(user);
      await user.click(screen.getByRole("button", { name: "Accept" }));

      screen.getByText("Changes could not be applied");
      screen.getByText("Network error");
    });
  });

  describe("success feedback", () => {
    it("shows success message after successful submission", async () => {
      const { user } = installerRender(<AuthenticationForm />);
      await enableFirstUser(user);
      await fillFirstUserFields(user);
      await user.click(screen.getByRole("button", { name: "Accept" }));

      await screen.findByText("Changes successfully applied");
      const link = screen.getByRole("link", { name: "installation" });
      expect(link).toHaveAttribute("href", "/overview");
    });
  });
});
