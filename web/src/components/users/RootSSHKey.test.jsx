/*
 * Copyright (c) [2022] SUSE LLC
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

import { act, screen, waitFor, within } from "@testing-library/react";
import { installerRender, createCallbackMock } from "~/test-utils";
import { createClient } from "~/client";
import { RootSSHKey } from "~/components/users";

jest.mock("~/client");

let sshKey;
const getRootSSHKeyFn = () => Promise.resolve(sshKey);
const setRootSSHKeyFn = jest.fn();
let onUsersChangeFn = jest.fn();
const testKey = "ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABgQDM+ test@example";

beforeEach(() => {
  sshKey = "";
  createClient.mockImplementation(() => {
    return {
      users: {
        getRootSSHKey: getRootSSHKeyFn,
        setRootSSHKey: setRootSSHKeyFn,
        onUsersChange: onUsersChangeFn
      }
    };
  });
});

it("allows defining a new root SSH public key", async () => {
  const { user } = installerRender(<RootSSHKey />);
  const rootSSHKey = await screen.findByText(/Root SSH public key/i);
  const button = within(rootSSHKey).getByRole("button", { name: "is not set" });
  await user.click(button);

  await screen.findByRole("dialog");

  const sshKeyInput = screen.getByLabelText("Root SSH public key");
  await user.type(sshKeyInput, testKey);

  const confirmButton = screen.getByRole("button", { name: /Confirm/i });
  expect(confirmButton).toBeEnabled();
  await user.click(confirmButton);

  expect(setRootSSHKeyFn).toHaveBeenCalledWith(testKey);

  await waitFor(() => {
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});

it("does not change anything if the user cancels", async () => {
  let openButton;

  const { user } = installerRender(<RootSSHKey />);

  const rootSSHKey = await screen.findByText(/Root SSH public key/i);
  openButton = within(rootSSHKey).getByRole("button", { name: "is not set" });
  await user.click(openButton);

  await screen.findByRole("dialog");

  const sshKeyInput = screen.getByLabelText("Root SSH public key");
  await user.type(sshKeyInput, testKey);

  const cancelButton = screen.getByRole("button", { name: /Cancel/i });
  await user.click(cancelButton);

  expect(setRootSSHKeyFn).not.toHaveBeenCalled();
  await waitFor(() => {
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  // Extra check to ensure the component is aware that nothing changed.
  openButton = within(rootSSHKey).getByRole("button", { name: "is not set" });
  expect(openButton).toBeInTheDocument();
});

describe("when the SSH public key is set", () => {
  beforeEach(() => {
    sshKey = testKey;
  });

  it("allows removing the SSH public key", async () => {
    const { user } = installerRender(<RootSSHKey />);
    const rootSSHKey = await screen.findByText(/Root SSH public key/i);
    const button = within(rootSSHKey).getByRole("button", { name: "is set" });
    await user.click(button);

    await screen.findByRole("dialog");

    const removeButton = await screen.findByRole("button", { name: /Do not use/i });
    await user.click(removeButton);

    expect(setRootSSHKeyFn).toHaveBeenCalledWith("");

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
  });
});

describe("when the Users change", () => {
  describe("and the RootSSHKey has been modified", () => {
    it("updates the proposal root SSH Key description", async () => {
      const [mockFunction, callbacks] = createCallbackMock();
      onUsersChangeFn = mockFunction;

      installerRender(<RootSSHKey />);
      let rootSSHKey = await screen.findByText(/Root SSH public key/i);
      within(rootSSHKey).getByRole("button", { name: "is not set" });

      const [cb] = callbacks;
      act(() => {
        cb({ rootSSHKey: true });
      });

      rootSSHKey = await screen.findByText(/Root SSH public key/i);
      within(rootSSHKey).getByRole("button", { name: "is set" });
    });
  });
});
