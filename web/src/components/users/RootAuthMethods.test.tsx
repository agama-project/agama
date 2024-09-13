/*
 * Copyright (c) [2023-2024] SUSE LLC
 *
 * All Rights Reserved.
 *
 * This program is free software; you can redistribute it and/or modify it
 * under the terms of version 2 of the GNU General Public License as published
 * by the Free Software Foundation.
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
import { plainRender } from "~/test-utils";
import { RootAuthMethods } from "~/components/users";

const mockRootUserMutation = { mutate: jest.fn(), mutateAsync: jest.fn() };
let mockPassword: boolean;
let mockSSHKey: string;

jest.mock("~/queries/users", () => ({
  ...jest.requireActual("~/queries/users"),
  useRootUser: () => ({ password: mockPassword, sshkey: mockSSHKey }),
  useRootUserMutation: () => mockRootUserMutation,
  useRootUserChanges: () => jest.fn(),
}));

const testKey = "ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABgQDM+ test@example";

beforeEach(() => {
  mockPassword = false;
  mockSSHKey = "";
});

describe("when no method is defined", () => {
  it("renders a text inviting the user to define at least one", () => {
    plainRender(<RootAuthMethods />);

    screen.getByText("No root authentication method defined yet.");
    screen.getByText(/at least one/);
  });
});

describe("and the password has been set", () => {
  beforeEach(() => {
    mockPassword = true;
  });

  it("renders the 'Already set' status", async () => {
    plainRender(<RootAuthMethods />);

    const table = await screen.findByRole("grid");
    const passwordRow = within(table).getByText("Password").closest("tr");
    within(passwordRow).getByText("Already set");
  });

  it("does not renders the 'Set' action", async () => {
    const { user } = plainRender(<RootAuthMethods />);

    const table = await screen.findByRole("grid");
    const passwordRow = within(table).getByText("Password").closest("tr");
    const actionsToggler = within(passwordRow).getByRole("button", { name: "Actions" });
    await user.click(actionsToggler);
    const setAction = within(passwordRow).queryByRole("menuitem", { name: "Set" });
    expect(setAction).toBeNull();
  });

  it("allows the user to change the already set password", async () => {
    const { user } = plainRender(<RootAuthMethods />);

    const table = await screen.findByRole("grid");
    const passwordRow = within(table).getByText("Password").closest("tr");
    const actionsToggler = within(passwordRow).getByRole("button", { name: "Actions" });
    await user.click(actionsToggler);
    const changeAction = within(passwordRow).queryByRole("menuitem", { name: "Change" });
    await user.click(changeAction);

    screen.getByRole("dialog", { name: "Change the root password" });
  });

  it("allows the user to discard the chosen password", async () => {
    const { user } = plainRender(<RootAuthMethods />);

    const table = await screen.findByRole("grid");
    const passwordRow = within(table).getByText("Password").closest("tr");
    const actionsToggler = within(passwordRow).getByRole("button", { name: "Actions" });
    await user.click(actionsToggler);
    const discardAction = within(passwordRow).queryByRole("menuitem", { name: "Discard" });
    await user.click(discardAction);

    expect(mockRootUserMutation.mutate).toHaveBeenCalledWith({ password: "" });
  });
});

describe("the password is not set yet", () => {
  // Mock another auth method for reaching the table
  beforeEach(() => {
    mockSSHKey = "Fake";
  });

  it("renders the 'Not set' status", async () => {
    plainRender(<RootAuthMethods />);

    const table = await screen.findByRole("grid");
    const passwordRow = within(table).getByText("Password").closest("tr");
    within(passwordRow).getByText("Not set");
  });

  it("allows the user to set a password", async () => {
    const { user } = plainRender(<RootAuthMethods />);

    const table = await screen.findByRole("grid");
    const passwordRow = within(table).getByText("Password").closest("tr");
    const actionsToggler = within(passwordRow).getByRole("button", { name: "Actions" });
    await user.click(actionsToggler);
    const setAction = within(passwordRow).getByRole("menuitem", { name: "Set" });
    await user.click(setAction);
    screen.getByRole("dialog", { name: "Set a root password" });
  });

  it("does not render the 'Change' nor the 'Discard' actions", async () => {
    const { user } = plainRender(<RootAuthMethods />);

    const table = await screen.findByRole("grid");
    const passwordRow = within(table).getByText("Password").closest("tr");
    const actionsToggler = within(passwordRow).getByRole("button", { name: "Actions" });
    await user.click(actionsToggler);

    const changeAction = within(passwordRow).queryByRole("menuitem", { name: "Change" });
    const discardAction = within(passwordRow).queryByRole("menuitem", { name: "Discard" });

    expect(changeAction).toBeNull();
    expect(discardAction).toBeNull();
  });
});

describe("and the SSH Key has been set", () => {
  beforeEach(() => {
    mockSSHKey = testKey;
  });

  it("renders its truncated content keeping the comment visible when possible", async () => {
    plainRender(<RootAuthMethods />);

    const table = await screen.findByRole("grid");
    const sshKeyRow = within(table).getByText("SSH Key").closest("tr");
    within(sshKeyRow).getByText("ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABgQDM+");
    within(sshKeyRow).getByText("test@example");
  });

  it("does not renders the 'Set' action", async () => {
    const { user } = plainRender(<RootAuthMethods />);

    const table = await screen.findByRole("grid");
    const sshKeyRow = within(table).getByText("SSH Key").closest("tr");
    const actionsToggler = within(sshKeyRow).getByRole("button", { name: "Actions" });
    await user.click(actionsToggler);
    const setAction = within(sshKeyRow).queryByRole("menuitem", { name: "Set" });
    expect(setAction).toBeNull();
  });

  it("allows the user to change it", async () => {
    const { user } = plainRender(<RootAuthMethods />);

    const table = await screen.findByRole("grid");
    const sshKeyRow = within(table).getByText("SSH Key").closest("tr");
    const actionsToggler = within(sshKeyRow).getByRole("button", { name: "Actions" });
    await user.click(actionsToggler);
    const changeAction = within(sshKeyRow).queryByRole("menuitem", { name: "Change" });
    await user.click(changeAction);

    screen.getByRole("dialog", { name: "Edit the SSH Public Key for root" });
  });

  it("allows the user to discard it", async () => {
    const { user } = plainRender(<RootAuthMethods />);

    const table = await screen.findByRole("grid");
    const sshKeyRow = within(table).getByText("SSH Key").closest("tr");
    const actionsToggler = within(sshKeyRow).getByRole("button", { name: "Actions" });
    await user.click(actionsToggler);
    const discardAction = within(sshKeyRow).queryByRole("menuitem", { name: "Discard" });
    await user.click(discardAction);

    expect(mockRootUserMutation.mutate).toHaveBeenCalledWith({ sshkey: "" });
  });
});

describe("but the SSH Key is not set yet", () => {
  // Mock another auth method for reaching the table
  beforeEach(() => {
    mockPassword = true;
  });

  it("renders the 'Not set' status", async () => {
    plainRender(<RootAuthMethods />);

    const table = await screen.findByRole("grid");
    const sshKeyRow = within(table).getByText("SSH Key").closest("tr");
    within(sshKeyRow).getByText("Not set");
  });

  it("allows the user to set a key", async () => {
    const { user } = plainRender(<RootAuthMethods />);

    const table = await screen.findByRole("grid");
    const sshKeyRow = within(table).getByText("SSH Key").closest("tr");
    const actionsToggler = within(sshKeyRow).getByRole("button", { name: "Actions" });
    await user.click(actionsToggler);
    const setAction = within(sshKeyRow).getByRole("menuitem", { name: "Set" });
    await user.click(setAction);
    screen.getByRole("dialog", { name: "Add a SSH Public Key for root" });
  });

  it("does not render the 'Change' nor the 'Discard' actions", async () => {
    const { user } = plainRender(<RootAuthMethods />);

    const table = await screen.findByRole("grid");
    const sshKeyRow = within(table).getByText("SSH Key").closest("tr");
    const actionsToggler = within(sshKeyRow).getByRole("button", { name: "Actions" });
    await user.click(actionsToggler);

    const changeAction = within(sshKeyRow).queryByRole("menuitem", { name: "Change" });
    const discardAction = within(sshKeyRow).queryByRole("menuitem", { name: "Discard" });

    expect(changeAction).toBeNull();
    expect(discardAction).toBeNull();
  });
});
