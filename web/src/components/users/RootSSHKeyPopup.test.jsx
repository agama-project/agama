/*
 * Copyright (c) [2022-2023] SUSE LLC
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
import { installerRender } from "~/test-utils";
import { createClient } from "~/client";
import { RootSSHKeyPopup } from "~/components/users";

jest.mock("~/client");

const onCloseCallback = jest.fn();
const setRootSSHKeyFn = jest.fn();
const testKey = "ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABgQDM+ test@example";

beforeEach(() => {
  createClient.mockImplementation(() => {
    return {
      users: {
        setRootSSHKey: setRootSSHKeyFn,
      },
    };
  });
});

describe("when it is closed", () => {
  it("renders nothing", async () => {
    const { container } = installerRender(<RootSSHKeyPopup />);
    await waitFor(() => expect(container).toBeEmptyDOMElement());
  });
});

describe("when it is open", () => {
  it("renders default title when none if given", async () => {
    installerRender(<RootSSHKeyPopup isOpen />);
    const dialog = await screen.findByRole("dialog");
    within(dialog).getByText("Set root SSH public key");
  });

  it("renders the given title", async () => {
    installerRender(<RootSSHKeyPopup isOpen title="Root SSHKey" />);
    const dialog = await screen.findByRole("dialog");
    within(dialog).getByText("Root SSHKey");
  });

  it("contains the given key, if any", async () => {
    installerRender(<RootSSHKeyPopup isOpen currentKey={testKey} />);
    const dialog = await screen.findByRole("dialog");
    within(dialog).getByText(testKey);
  });

  it("allows defining a new root SSH public key", async () => {
    const { user } = installerRender(<RootSSHKeyPopup isOpen onClose={onCloseCallback} />);

    const dialog = await screen.findByRole("dialog");
    const sshKeyInput = within(dialog).getByLabelText("Root SSH public key");
    const confirmButton = within(dialog).getByRole("button", { name: /Confirm/i });

    expect(confirmButton).toBeDisabled();
    await user.type(sshKeyInput, testKey);
    expect(confirmButton).toBeEnabled();
    await user.click(confirmButton);

    expect(setRootSSHKeyFn).toHaveBeenCalledWith(testKey);
    expect(onCloseCallback).toHaveBeenCalled();
  });

  it("does not change anything if the user cancels", async () => {
    const { user } = installerRender(<RootSSHKeyPopup isOpen onClose={onCloseCallback} />);
    const dialog = await screen.findByRole("dialog");
    const sshKeyInput = within(dialog).getByLabelText("Root SSH public key");
    const cancelButton = within(dialog).getByRole("button", { name: /Cancel/i });

    await user.type(sshKeyInput, testKey);
    await user.click(cancelButton);

    expect(setRootSSHKeyFn).not.toHaveBeenCalled();
    expect(onCloseCallback).toHaveBeenCalled();
  });
});
