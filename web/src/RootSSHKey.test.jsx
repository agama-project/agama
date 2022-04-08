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

import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { authRender } from "./test-utils";
import { createClient } from "./client";
import RootSSHKey from "./RootSSHKey";

jest.mock("./client");

let sshKey;
const getRootSSHKeyFn = () => sshKey;
const setRootSSHKeyFn = jest.fn();
const testKey = "ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABgQDM+ test@example";

beforeEach(() => {
  sshKey = "";
  createClient.mockImplementation(() => {
    return {
      users: {
        getRootSSHKey: getRootSSHKeyFn,
        setRootSSHKey: setRootSSHKeyFn
      }
    };
  });
});

it("allows defining a new root SSH public key", async () => {
  authRender(<RootSSHKey />);
  const rootSSHKey = await screen.findByText(/Root SSH public key/i);
  const button = within(rootSSHKey).getByRole("button", { name: "is not set" });
  userEvent.click(button);

  await screen.findByRole("dialog");

  const sshKeyInput = screen.getByLabelText("Root SSH public key");
  userEvent.type(sshKeyInput, testKey);

  const confirmButton = screen.getByRole("button", { name: /Confirm/i });
  expect(confirmButton).toBeEnabled();
  userEvent.click(confirmButton);

  expect(setRootSSHKeyFn).toHaveBeenCalledWith(testKey);

  await waitFor(() => {
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});

it("does not change anything if the user cancels", async () => {
  let openButton;

  authRender(<RootSSHKey />);

  const rootSSHKey = await screen.findByText(/Root SSH public key/i);
  openButton = within(rootSSHKey).getByRole("button", { name: "is not set" });
  userEvent.click(openButton);

  await screen.findByRole("dialog");

  const sshKeyInput = screen.getByLabelText("Root SSH public key");
  userEvent.type(sshKeyInput, testKey);

  const cancelButton = screen.getByRole("button", { name: /Cancel/i });
  userEvent.click(cancelButton);

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
    authRender(<RootSSHKey />);
    const rootSSHKey = await screen.findByText(/Root SSH public key/i);
    const button = within(rootSSHKey).getByRole("button", { name: "is set" });
    userEvent.click(button);

    await screen.findByRole("dialog");

    const removeButton = await screen.findByRole("button", { name: /Do not use/i });
    userEvent.click(removeButton);

    expect(setRootSSHKeyFn).toHaveBeenCalledWith("");

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
  });
});
