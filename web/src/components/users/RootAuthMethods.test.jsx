/*
 * Copyright (c) [2023] SUSE LLC
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

import { act, screen, within } from "@testing-library/react";
import { installerRender, createCallbackMock, mockComponent } from "~/test-utils";
import { createClient } from "~/client";

import { RootAuthMethods } from "~/components/users";

jest.mock("~/client");
jest.mock("@patternfly/react-core", () => {
  const original = jest.requireActual("@patternfly/react-core");

  return {
    ...original,
    Skeleton: mockComponent("PFSkeleton")
  };
});

let onUsersChangeFn = jest.fn();
const isRootPasswordSetFn = jest.fn();
const getRootSSHKeyFn = jest.fn();
const setRootSSHKeyFn = jest.fn();
const removeRootPasswordFn = jest.fn();
const testKey = "ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABgQDM+ test@example";

beforeEach(() => {
  isRootPasswordSetFn.mockResolvedValue(false);
  getRootSSHKeyFn.mockResolvedValue("");
  onUsersChangeFn.mockResolvedValue({});

  createClient.mockImplementation(() => {
    return {
      users: {
        isRootPasswordSet: isRootPasswordSetFn,
        getRootSSHKey: getRootSSHKeyFn,
        setRootSSHKey: setRootSSHKeyFn,
        onUsersChange: onUsersChangeFn,
        removeRootPassword: removeRootPasswordFn
      }
    };
  });
});

describe("when loading initial data", () => {
  it("renders a loading component", async () => {
    installerRender(<RootAuthMethods />);
    await screen.findAllByText("PFSkeleton");
  });
});

describe("when ready", () => {
  it("renders a table holding available methods", async () => {
    installerRender(<RootAuthMethods />);

    const table = await screen.findByRole("grid");
    within(table).getByText("Password");
    within(table).getByText("SSH Key");
  });

  describe("and the password has been set", () => {
    beforeEach(() => isRootPasswordSetFn.mockResolvedValue(true));

    it("renders the 'Already set' status", async () => {
      installerRender(<RootAuthMethods />);

      const table = await screen.findByRole("grid");
      const passwordRow = within(table).getByText("Password")
        .closest("tr");
      within(passwordRow).getByText("Already set");
    });

    it("does not renders the 'Set' action", async () => {
      const { user } = installerRender(<RootAuthMethods />);

      const table = await screen.findByRole("grid");
      const passwordRow = within(table).getByText("Password")
        .closest("tr");
      const actionsToggler = within(passwordRow).getByRole("button", { name: "Actions" });
      await user.click(actionsToggler);
      const setAction = within(passwordRow).queryByRole("menuitem", { name: "Set" });
      expect(setAction).toBeNull();
    });

    it("allows the user to change the already set password", async() => {
      const { user } = installerRender(<RootAuthMethods />);

      const table = await screen.findByRole("grid");
      const passwordRow = within(table).getByText("Password")
        .closest("tr");
      const actionsToggler = within(passwordRow).getByRole("button", { name: "Actions" });
      await user.click(actionsToggler);
      const changeAction = await within(passwordRow).queryByRole("menuitem", { name: "Change" });
      await user.click(changeAction);

      screen.getByRole("dialog", { name: "Change the root password" });
    });

    it("allows the user to discard the chosen password", async() => {
      const { user } = installerRender(<RootAuthMethods />);

      const table = await screen.findByRole("grid");
      const passwordRow = within(table).getByText("Password")
        .closest("tr");
      const actionsToggler = within(passwordRow).getByRole("button", { name: "Actions" });
      await user.click(actionsToggler);
      const discardAction = await within(passwordRow).queryByRole("menuitem", { name: "Discard" });
      await user.click(discardAction);

      expect(removeRootPasswordFn).toHaveBeenCalled();
    });
  });

  describe("but the password is not set yet", () => {
    it("renders the 'Not set' status", async () => {
      installerRender(<RootAuthMethods />);

      const table = await screen.findByRole("grid");
      const passwordRow = within(table).getByText("Password")
        .closest("tr");
      within(passwordRow).getByText("Not set");
    });

    it("allows the user to set a password", async () => {
      const { user } = installerRender(<RootAuthMethods />);

      const table = await screen.findByRole("grid");
      const passwordRow = within(table).getByText("Password")
        .closest("tr");
      const actionsToggler = within(passwordRow).getByRole("button", { name: "Actions" });
      await user.click(actionsToggler);
      const setAction = within(passwordRow).getByRole("menuitem", { name: "Set" });
      await user.click(setAction);
      screen.getByRole("dialog", { name: "Set a root password" });
    });

    it("does not render the 'Change' nor the 'Discard' actions", async () => {
      const { user } = installerRender(<RootAuthMethods />);

      const table = await screen.findByRole("grid");
      const passwordRow = within(table).getByText("Password")
        .closest("tr");
      const actionsToggler = within(passwordRow).getByRole("button", { name: "Actions" });
      await user.click(actionsToggler);

      const changeAction = await within(passwordRow).queryByRole("menuitem", { name: "Change" });
      const discardAction = await within(passwordRow).queryByRole("menuitem", { name: "Discard" });

      expect(changeAction).toBeNull();
      expect(discardAction).toBeNull();
    });
  });

  describe("and the SSH Key has been set", () => {
    beforeEach(() => getRootSSHKeyFn.mockResolvedValue(testKey));

    it("renders its truncated content keeping the comment visible when possible", async () => {
      installerRender(<RootAuthMethods />);

      const table = await screen.findByRole("grid");
      const sshKeyRow = within(table).getByText("SSH Key")
        .closest("tr");
      within(sshKeyRow).getByText("ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABgQDM+");
      within(sshKeyRow).getByText("test@example");
    });

    it("does not renders the 'Set' action", async () => {
      const { user } = installerRender(<RootAuthMethods />);

      const table = await screen.findByRole("grid");
      const sshKeyRow = within(table).getByText("SSH Key")
        .closest("tr");
      const actionsToggler = within(sshKeyRow).getByRole("button", { name: "Actions" });
      await user.click(actionsToggler);
      const setAction = within(sshKeyRow).queryByRole("menuitem", { name: "Set" });
      expect(setAction).toBeNull();
    });

    it("allows the user to change it", async() => {
      const { user } = installerRender(<RootAuthMethods />);

      const table = await screen.findByRole("grid");
      const sshKeyRow = within(table).getByText("SSH Key")
        .closest("tr");
      const actionsToggler = within(sshKeyRow).getByRole("button", { name: "Actions" });
      await user.click(actionsToggler);
      const changeAction = await within(sshKeyRow).queryByRole("menuitem", { name: "Change" });
      await user.click(changeAction);

      screen.getByRole("dialog", { name: "Edit the SSH Public Key for root" });
    });

    it("allows the user to discard it", async() => {
      const { user } = installerRender(<RootAuthMethods />);

      const table = await screen.findByRole("grid");
      const sshKeyRow = within(table).getByText("SSH Key")
        .closest("tr");
      const actionsToggler = within(sshKeyRow).getByRole("button", { name: "Actions" });
      await user.click(actionsToggler);
      const discardAction = await within(sshKeyRow).queryByRole("menuitem", { name: "Discard" });
      await user.click(discardAction);

      expect(setRootSSHKeyFn).toHaveBeenCalledWith("");
    });
  });

  describe("but the SSH Key is not set yet", () => {
    it("renders the 'Not set' status", async () => {
      installerRender(<RootAuthMethods />);

      const table = await screen.findByRole("grid");
      const sshKeyRow = within(table).getByText("SSH Key")
        .closest("tr");
      within(sshKeyRow).getByText("Not set");
    });

    it("allows the user to set a key", async () => {
      const { user } = installerRender(<RootAuthMethods />);

      const table = await screen.findByRole("grid");
      const sshKeyRow = within(table).getByText("SSH Key")
        .closest("tr");
      const actionsToggler = within(sshKeyRow).getByRole("button", { name: "Actions" });
      await user.click(actionsToggler);
      const setAction = within(sshKeyRow).getByRole("menuitem", { name: "Set" });
      await user.click(setAction);
      screen.getByRole("dialog", { name: "Add a SSH Public Key for root" });
    });

    it("does not render the 'Change' nor the 'Discard' actions", async () => {
      const { user } = installerRender(<RootAuthMethods />);

      const table = await screen.findByRole("grid");
      const sshKeyRow = within(table).getByText("SSH Key")
        .closest("tr");
      const actionsToggler = within(sshKeyRow).getByRole("button", { name: "Actions" });
      await user.click(actionsToggler);

      const changeAction = await within(sshKeyRow).queryByRole("menuitem", { name: "Change" });
      const discardAction = await within(sshKeyRow).queryByRole("menuitem", { name: "Discard" });

      expect(changeAction).toBeNull();
      expect(discardAction).toBeNull();
    });
  });

  describe("and user settings changes", () => {
    it("updates the UI accordingly", async () => {
      const [mockFunction, callbacks] = createCallbackMock();
      onUsersChangeFn = mockFunction;

      installerRender(<RootAuthMethods />);
      await screen.findAllByText("Not set");

      const [cb] = callbacks;
      act(() => {
        cb({ rootPasswordSet: true, rootSSHKey: testKey });
      });

      await screen.findByText("Already set");
      await screen.findByText("test@example");
    });
  });
});
