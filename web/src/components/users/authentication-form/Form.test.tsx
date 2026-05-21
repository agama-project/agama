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
import AuthenticationForm from "./Form";

let mockFirstUser:
  | {
      fullName?: string;
      userName?: string;
      password?: string;
      hashedPassword?: boolean;
      sshPublicKeys?: string | string[];
    }
  | undefined;
let mockRootUser:
  | { password?: string; hashedPassword?: boolean; sshPublicKeys?: string }
  | undefined;
const mockPatchConfig = jest.fn().mockResolvedValue(true);

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
  patchConfig: (config) => mockPatchConfig(config),
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

      expect(mockPatchConfig).not.toHaveBeenCalled();
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

      expect(mockPatchConfig).toHaveBeenCalledWith(
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

      expect(mockPatchConfig).toHaveBeenCalledWith(
        expect.objectContaining({
          user: null,
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

      expect(mockPatchConfig).not.toHaveBeenCalled();
      screen.getByText("Full name is required");
      screen.getByText("Username is required");
    });
  });

  describe("server errors", () => {
    it("displays error alert when API call fails", async () => {
      mockPatchConfig.mockRejectedValueOnce({ message: "Network error" });

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
