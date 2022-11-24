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
import { installerRender, createCallbackMock } from "@/test-utils";
import { createClient } from "@client";

import { RootPassword } from "@components/users";

jest.mock("@client");

let isRootPasswordSetFn;
let setRootPasswordFn = jest.fn();
let onUsersChangeFn = jest.fn();
const getRootSSHKeyFn = () => "";
const removeRootPasswordFn = jest.fn();

beforeEach(() => {
  isRootPasswordSetFn = () => Promise.resolve(false);
  createClient.mockImplementation(() => {
    return {
      users: {
        isRootPasswordSet: isRootPasswordSetFn,
        setRootPassword: setRootPasswordFn,
        removeRootPassword: removeRootPasswordFn,
        getRootSSHKey: getRootSSHKeyFn,
        onUsersChange: onUsersChangeFn
      }
    };
  });
});

describe("while waiting for the root password status", () => {
  it.skip("displays a loading component", async () => {
    installerRender(<RootPassword />);
    await screen.findByText("Loading root password status");
  });
});

it("allows changing the password ", async () => {
  const password = "nots3cr3t";
  const { user } = installerRender(<RootPassword />);
  const rootPassword = await screen.findByText(/Root password/i);
  const button = within(rootPassword).getByRole("button", { name: "is not set" });
  await user.click(button);

  await screen.findByRole("dialog");

  const passwordInput = await screen.findByLabelText("New root password");
  await user.type(passwordInput, password);

  const confirmButton = await screen.findByRole("button", { name: /Confirm/i });
  expect(confirmButton).toBeEnabled();
  await user.click(confirmButton);

  expect(setRootPasswordFn).toHaveBeenCalledWith(password);

  await waitFor(() => {
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});

describe("when the password is not set", () => {
  it("displays a disabled remove button", async () => {
    const { user } = installerRender(<RootPassword />);
    const rootPassword = await screen.findByText(/Root password/i);
    const button = within(rootPassword).getByRole("button", { name: "is not set" });
    await user.click(button);

    const removeButton = await screen.findByRole("button", { name: "Do not use a password" });
    expect(removeButton).toBeDisabled();
  });
});

describe("when the password is set", () => {
  beforeEach(() => {
    isRootPasswordSetFn = () => Promise.resolve(true);
  });

  it("allows removing the password", async () => {
    const { user } = installerRender(<RootPassword />);
    const rootPassword = await screen.findByText(/Root password/i);
    const button = within(rootPassword).getByRole("button", { name: "is set" });
    await user.click(button);

    const removeButton = await screen.findByRole("button", { name: "Do not use a password" });
    await user.click(removeButton);

    expect(removeRootPasswordFn).toHaveBeenCalled();
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
  });
});

it("does not change the password if the user cancels", async () => {
  const { user } = installerRender(<RootPassword />);
  const rootPassword = await screen.findByText(/Root password/i);
  const button = within(rootPassword).getByRole("button", { name: "is not set" });
  await user.click(button);

  await screen.findByRole("dialog");
  const cancelButton = await screen.findByRole("button", { name: /Cancel/i });
  await user.click(cancelButton);

  expect(setRootPasswordFn).not.toHaveBeenCalled();
  await waitFor(() => {
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});

describe("when an error happens while changing the password", () => {
  beforeEach(() => {
    setRootPasswordFn = jest.fn().mockImplementation(() => {
      throw new Error("Error while setting the root password");
    });
  });

  it.skip("displays an error", async () => {
    const { user } = installerRender(<RootPassword />);
    const rootPassword = await screen.findByText(/Root password/i);
    const button = within(rootPassword).getByRole("button", { name: "is not set" });
    await user.click(button);

    await screen.findByRole("dialog");
    const cancelButton = await screen.findByRole("button", { name: /Cancel/i });
    await user.click(cancelButton);

    await screen.findByText(/Something went wrong/i);
  });
});

describe("when the Users change", () => {
  describe("and the RootPassword has been modified", () => {
    it("updates the proposal root password description", async () => {
      const [mockFunction, callbacks] = createCallbackMock();
      onUsersChangeFn = mockFunction;

      installerRender(<RootPassword />);
      let rootPassword = await screen.findByText(/Root password/i);
      within(rootPassword).getByRole("button", { name: "is not set" });

      const [cb] = callbacks;
      act(() => {
        cb({ rootPasswordSet: true });
      });

      rootPassword = await screen.findByText(/Root password/i);
      within(rootPassword).getByRole("button", { name: "is set" });
    });
  });
});
