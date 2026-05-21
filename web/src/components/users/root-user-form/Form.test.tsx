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

import React from "react";
import { screen, within } from "@testing-library/react";
import { installerRender } from "~/test-utils";
import RootUserForm from "./Form";

let mockPassword: string;
let mockPublicKey: string;
let mockHashedPassword: boolean;
const mockPatchConfig = jest.fn().mockResolvedValue(true);

jest.mock("~/components/users/PasswordCheck", () => () => <div>PasswordCheck Mock</div>);

jest.mock("~/hooks/model/config", () => ({
  ...jest.requireActual("~/hooks/model/config"),
  useConfig: () => ({
    root: {
      password: mockPassword,
      sshPublicKey: mockPublicKey,
      hashedPassword: mockHashedPassword,
    },
  }),
}));

jest.mock("~/api", () => ({
  ...jest.requireActual("~/api"),
  patchConfig: (config) => mockPatchConfig(config),
}));

describe("RootUserForm", () => {
  beforeEach(() => {
    mockPassword = "n0ts3cr3t";
    mockHashedPassword = false;
    mockPublicKey = "";
  });

  it("allows setting/editing a password", async () => {
    const { user } = installerRender(<RootUserForm />);
    const acceptButton = screen.getByRole("button", { name: "Accept" });
    const passwordInput = screen.getByLabelText("Password");
    const passwordConfirmationInput = screen.getByLabelText("Password confirmation");
    await user.clear(passwordInput);
    await user.type(passwordInput, "m0r3S3cr3t");
    await user.clear(passwordConfirmationInput);
    await user.type(passwordConfirmationInput, "m0r3S3cr3t");
    await user.click(acceptButton);
    expect(mockPatchConfig).toHaveBeenCalledWith(
      expect.objectContaining({
        root: { password: "m0r3S3cr3t", hashedPassword: false, sshPublicKey: "" },
      }),
    );
  });

  it("does not allow setting an empty password", async () => {
    const { user } = installerRender(<RootUserForm />);
    const acceptButton = screen.getByRole("button", { name: "Accept" });
    const passwordInput = screen.getByLabelText("Password");
    const passwordConfirmationInput = screen.getByLabelText("Password confirmation");
    await user.clear(passwordInput);
    await user.clear(passwordConfirmationInput);
    expect(passwordInput).toHaveValue("");
    expect(passwordConfirmationInput).toHaveValue("");
    await user.click(acceptButton);
    screen.getByText("Password is required");
    expect(mockPatchConfig).not.toHaveBeenCalled();
  });

  it("renders password validation errors, if any", async () => {
    const { user } = installerRender(<RootUserForm />);
    const acceptButton = screen.getByRole("button", { name: "Accept" });
    const passwordInput = screen.getByLabelText("Password");
    const passwordConfirmationInput = screen.getByLabelText("Password confirmation");
    await user.type(passwordInput, "n0tS3cr3t");
    await user.type(passwordConfirmationInput, "S3cr3t");
    await user.click(acceptButton);
    screen.getByText("Passwords do not match");
    expect(mockPatchConfig).not.toHaveBeenCalled();
  });

  it("allows clearing the password", async () => {
    const { user } = installerRender(<RootUserForm />);
    const authSelector = screen.getByRole("button", { name: /Authentication/ });
    const acceptButton = screen.getByRole("button", { name: "Accept" });
    await user.click(authSelector);
    const listbox = screen.getByRole("listbox");
    const noneOption = within(listbox).getByRole("option", { name: /None/ });
    await user.click(noneOption);
    await user.click(acceptButton);
    expect(mockPatchConfig).toHaveBeenCalledWith(
      expect.objectContaining({
        root: expect.objectContaining({ password: "", hashedPassword: false }),
      }),
    );
  });

  it("allows setting a public SSH Key", async () => {
    const { user } = installerRender(<RootUserForm />);
    const authSelector = screen.getByRole("button", { name: /Authentication/ });
    await user.click(authSelector);
    const listbox = screen.getByRole("listbox");
    const sshKeyOption = within(listbox).getByRole("option", { name: /SSH Public Key/ });
    await user.click(sshKeyOption);
    const sshPublicKeyInput = screen.getByRole("textbox", { name: "SSH Public Keys" });
    await user.type(sshPublicKeyInput, "ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABgQDM+ test@example");
    await user.keyboard("{Enter}");
    const acceptButton = screen.getByRole("button", { name: "Accept" });
    await user.click(acceptButton);
    expect(mockPatchConfig).toHaveBeenCalledWith(
      expect.objectContaining({
        root: expect.objectContaining({
          sshPublicKey: "ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABgQDM+ test@example",
        }),
      }),
    );
  });

  it("does not allow setting an empty public SSH Key", async () => {
    const { user } = installerRender(<RootUserForm />);
    const authSelector = screen.getByRole("button", { name: /Authentication/ });
    await user.click(authSelector);
    const listbox = screen.getByRole("listbox");
    const sshKeyOption = within(listbox).getByRole("option", { name: /SSH Public Key/ });
    await user.click(sshKeyOption);
    const acceptButton = screen.getByRole("button", { name: "Accept" });
    await user.click(acceptButton);
    screen.getByText("At least one SSH public key is required");
    expect(mockPatchConfig).not.toHaveBeenCalled();
  });

  it("allows clearing the public SSH Key", async () => {
    mockPublicKey = "ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABgQDM+ test@example";
    const { user } = installerRender(<RootUserForm />);
    const authSelector = screen.getByRole("button", { name: /Authentication/ });
    const acceptButton = screen.getByRole("button", { name: "Accept" });
    await user.click(authSelector);
    const noneOption = await screen.findByRole("option", { name: /None/ });
    await user.click(noneOption);
    await user.click(acceptButton);
    expect(mockPatchConfig).toHaveBeenCalledWith(
      expect.objectContaining({
        root: expect.objectContaining({ sshPublicKey: "" }),
      }),
    );
  });

  it("allows using both password and SSH key", async () => {
    const { user } = installerRender(<RootUserForm />);
    const authSelector = screen.getByRole("button", { name: /Authentication/ });
    await user.click(authSelector);
    const listbox = screen.getByRole("listbox");
    const bothOption = within(listbox).getByRole("option", { name: /Both/ });
    await user.click(bothOption);
    const passwordInput = screen.getByLabelText("Password");
    const passwordConfirmationInput = screen.getByLabelText("Password confirmation");
    await user.type(passwordInput, "n0tS3cr3t");
    await user.type(passwordConfirmationInput, "n0tS3cr3t");
    const sshPublicKeyInput = screen.getByRole("textbox", { name: "SSH Public Keys" });
    await user.type(sshPublicKeyInput, "ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABgQDM+ test@example");
    await user.keyboard("{Enter}");
    const acceptButton = screen.getByRole("button", { name: "Accept" });
    await user.click(acceptButton);
    expect(mockPatchConfig).toHaveBeenCalledWith(
      expect.objectContaining({
        root: expect.objectContaining({
          password: "n0tS3cr3t",
          hashedPassword: false,
          sshPublicKey: "ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABgQDM+ test@example",
        }),
      }),
    );
  });

  describe("when a hashed password is set", () => {
    beforeEach(() => {
      mockPassword = "h4$hPwd";
      mockHashedPassword = true;
    });

    it("allows preserving it", async () => {
      const { user } = installerRender(<RootUserForm />);
      const acceptButton = screen.getByRole("button", { name: "Accept" });
      screen.getByText("Using a hashed password.");
      await user.click(acceptButton);
      expect(mockPatchConfig).toHaveBeenCalledWith(
        expect.not.objectContaining({ hashedPassword: false }),
      );
      expect(mockPatchConfig).toHaveBeenCalledWith(
        expect.objectContaining({
          root: expect.not.objectContaining({ hashedPassword: false }),
        }),
      );
    });

    it("allows discarding it", async () => {
      const { user } = installerRender(<RootUserForm />);
      const authSelector = screen.getByRole("button", { name: /Authentication/ });
      const acceptButton = screen.getByRole("button", { name: "Accept" });
      await user.click(authSelector);
      const listbox = screen.getByRole("listbox");
      const noneOption = within(listbox).getByRole("option", { name: /None/ });
      await user.click(noneOption);
      await user.click(acceptButton);
      expect(mockPatchConfig).toHaveBeenCalledWith(
        expect.objectContaining({
          root: expect.objectContaining({ hashedPassword: false, password: "" }),
        }),
      );
    });

    it("allows using a plain password instead", async () => {
      const { user } = installerRender(<RootUserForm />);
      const acceptButton = screen.getByRole("button", { name: "Accept" });
      const changeToPlainButton = screen.getByRole("button", { name: "Change" });
      await user.click(changeToPlainButton);
      const passwordInput = screen.getByLabelText("Password");
      const passwordConfirmationInput = screen.getByLabelText("Password confirmation");
      await user.type(passwordInput, "n0tS3cr3t");
      await user.type(passwordConfirmationInput, "n0tS3cr3t");
      await user.click(acceptButton);
      expect(mockPatchConfig).toHaveBeenCalledWith(
        expect.objectContaining({
          root: expect.objectContaining({ hashedPassword: false, password: "n0tS3cr3t" }),
        }),
      );
    });
  });
});
