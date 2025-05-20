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
import RootUserForm from "./RootUserForm";

let mockPassword: string;
let mockPublicKey: string;
let mockHashedPassword: boolean;
const mockRootUserMutation = jest.fn().mockResolvedValue(true);

jest.mock("~/components/product/ProductRegistrationAlert", () => () => (
  <div>ProductRegistrationAlert Mock</div>
));

jest.mock("~/queries/users", () => ({
  ...jest.requireActual("~/queries/users"),
  useRootUser: () => ({
    password: mockPassword,
    sshPublicKey: mockPublicKey,
    hashedPassword: mockHashedPassword,
  }),
  useRootUserMutation: () => ({
    mutateAsync: mockRootUserMutation,
  }),
}));

describe("RootUserForm", () => {
  beforeEach(() => {
    mockPassword = "n0ts3cr3t";
    mockHashedPassword = false;
    mockPublicKey = "";
  });

  it("allows setting/editing a password", async () => {
    const { user } = installerRender(<RootUserForm />, { withL10n: true });
    const acceptButton = screen.getByRole("button", { name: "Accept" });
    const passwordInput = screen.getByLabelText("Password");
    const passwordConfirmationInput = screen.getByLabelText("Password confirmation");
    await user.clear(passwordInput);
    await user.type(passwordInput, "m0r3S3cr3t");
    await user.clear(passwordConfirmationInput);
    await user.type(passwordConfirmationInput, "m0r3S3cr3t");
    await user.click(acceptButton);
    expect(mockRootUserMutation).toHaveBeenCalledWith(
      expect.objectContaining({ password: "m0r3S3cr3t", hashedPassword: false }),
    );
  });

  it("does not allow setting an empty password", async () => {
    const { user } = installerRender(<RootUserForm />, { withL10n: true });
    const acceptButton = screen.getByRole("button", { name: "Accept" });
    const passwordInput = screen.getByLabelText("Password");
    const passwordConfirmationInput = screen.getByLabelText("Password confirmation");
    await user.clear(passwordInput);
    await user.clear(passwordConfirmationInput);
    expect(passwordInput).toHaveValue("");
    expect(passwordConfirmationInput).toHaveValue("");
    await user.click(acceptButton);
    screen.getByText("Warning alert:");
    screen.getByText("Password is empty.");
    expect(mockRootUserMutation).not.toHaveBeenCalled();
  });

  it("renders password validation errors, if any", async () => {
    const { user } = installerRender(<RootUserForm />, { withL10n: true });
    const acceptButton = screen.getByRole("button", { name: "Accept" });
    const passwordInput = screen.getByLabelText("Password");
    const passwordConfirmationInput = screen.getByLabelText("Password confirmation");
    await user.type(passwordInput, "n0tS3cr3t");
    await user.type(passwordConfirmationInput, "S3cr3t");
    await user.click(acceptButton);
    screen.getByText("Warning alert:");
    screen.getByText("Passwords do not match");
    expect(mockRootUserMutation).not.toHaveBeenCalled();
  });

  it("allows clearing the password", async () => {
    const { user } = installerRender(<RootUserForm />, { withL10n: true });
    const passwordToggle = screen.getByRole("checkbox", { name: "Use password" });
    const acceptButton = screen.getByRole("button", { name: "Accept" });
    expect(passwordToggle).toBeChecked();
    await user.click(passwordToggle);
    expect(passwordToggle).not.toBeChecked();
    await user.click(acceptButton);
    expect(mockRootUserMutation).toHaveBeenCalledWith(
      expect.objectContaining({ password: "", hashedPassword: false }),
    );
  });

  it("allows setting a public SSH Key ", async () => {
    const { user } = installerRender(<RootUserForm />, { withL10n: true });
    const sshPublicKeyToggle = screen.getByRole("checkbox", { name: "Use public SSH Key" });
    const acceptButton = screen.getByRole("button", { name: "Accept" });
    await user.click(sshPublicKeyToggle);
    const sshPublicKeyInput = screen.getByRole("textbox", { name: "File upload" });
    await user.type(sshPublicKeyInput, "ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABgQDM+ test@example");
    await user.click(acceptButton);
    expect(mockRootUserMutation).toHaveBeenCalledWith(
      expect.objectContaining({
        sshPublicKey: "ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABgQDM+ test@example",
      }),
    );
  });

  it("does not allow setting an empty public SSH Key", async () => {
    const { user } = installerRender(<RootUserForm />, { withL10n: true });
    const sshPublicKeyToggle = screen.getByRole("checkbox", { name: "Use public SSH Key" });
    const acceptButton = screen.getByRole("button", { name: "Accept" });
    await user.click(sshPublicKeyToggle);
    expect(sshPublicKeyToggle).toBeChecked();
    await user.click(acceptButton);
    screen.getByText("Warning alert:");
    screen.getByText("Public SSH Key is empty.");
    expect(mockRootUserMutation).not.toHaveBeenCalled();
  });

  it("allows clearing the public SSH Key", async () => {
    mockPublicKey = "ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABgQDM+ test@example";
    const { user } = installerRender(<RootUserForm />, { withL10n: true });
    const sshPublicKeyToggle = screen.getByRole("checkbox", { name: "Use public SSH Key" });
    const acceptButton = screen.getByRole("button", { name: "Accept" });
    expect(sshPublicKeyToggle).toBeChecked();
    await user.click(sshPublicKeyToggle);
    expect(sshPublicKeyToggle).not.toBeChecked();
    await user.click(acceptButton);
    expect(mockRootUserMutation).toHaveBeenCalledWith(
      expect.objectContaining({ sshPublicKey: "" }),
    );
  });

  describe("when a hashed password is set", () => {
    beforeEach(() => {
      mockPassword = "h4$hPwd";
      mockHashedPassword = true;
    });

    it("allows preserving it", async () => {
      const { user } = installerRender(<RootUserForm />, { withL10n: true });
      const passwordToggle = screen.getByRole("checkbox", { name: "Use password" });
      const acceptButton = screen.getByRole("button", { name: "Accept" });
      expect(passwordToggle).toBeChecked();
      screen.getByText("Using a hashed password.");
      await user.click(acceptButton);
      expect(mockRootUserMutation).toHaveBeenCalledWith(
        expect.not.objectContaining({ hashedPassword: false }),
      );
    });

    it("allows discarding it", async () => {
      const { user } = installerRender(<RootUserForm />, { withL10n: true });
      const passwordToggle = screen.getByRole("checkbox", { name: "Use password" });
      const acceptButton = screen.getByRole("button", { name: "Accept" });
      expect(passwordToggle).toBeChecked();
      await user.click(passwordToggle);
      expect(passwordToggle).not.toBeChecked();
      await user.click(acceptButton);
      expect(mockRootUserMutation).toHaveBeenCalledWith(
        expect.objectContaining({ hashedPassword: false, password: "" }),
      );
    });

    it("allows using a plain password instead", async () => {
      const { user } = installerRender(<RootUserForm />, { withL10n: true });
      const acceptButton = screen.getByRole("button", { name: "Accept" });
      const changeToPlainButton = screen.getByRole("button", { name: "Change" });
      await user.click(changeToPlainButton);
      const passwordInput = screen.getByLabelText("Password");
      const passwordConfirmationInput = screen.getByLabelText("Password confirmation");
      await user.type(passwordInput, "n0tS3cr3t");
      await user.type(passwordConfirmationInput, "n0tS3cr3t");
      await user.click(acceptButton);
      expect(mockRootUserMutation).toHaveBeenCalledWith(
        expect.objectContaining({ hashedPassword: false, password: "n0tS3cr3t" }),
      );
    });
  });
});
