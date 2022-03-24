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
import userEvent from "@testing-library/user-event";
import { authRender } from "./test-utils";
import { createClient } from "./lib/client";

import RootPassword from "./RootPassword";

jest.mock("./lib/client");

let isRootPasswordSetFn;
let setRootPasswordFn = jest.fn();
let getRootSSHKeyFn = () => "";
let removeRootPasswordFn = jest.fn();

beforeEach(() => {
  isRootPasswordSetFn = () => Promise.resolve(false);
  createClient.mockImplementation(() => {
    return {
      users: {
        isRootPasswordSet: isRootPasswordSetFn,
        setRootPassword: setRootPasswordFn,
        removeRootPassword: removeRootPasswordFn,
        getRootSSHKey: getRootSSHKeyFn
      }
    };
  });
});

describe("while waiting for the root password status", () => {
  it.skip("displays a loading component", async () => {
    authRender(<RootPassword />);
    await screen.findByText("Loading root password status");
  });
});

it("allows changing the password ", async () => {
  const password = "nots3cr3t";
  authRender(<RootPassword />);
  const rootPassword = await screen.findByText(/Root password/i);
  const button = within(rootPassword).getByRole("button", { name: "is not set" });
  userEvent.click(button);

  await screen.findByRole("dialog");

  const passwordInput = await screen.findByLabelText("New root password");
  userEvent.type(passwordInput, password);

  const confirmButton = await screen.findByRole("button", { name: /Confirm/i });
  expect(confirmButton).toBeEnabled();

  act(() => {
    userEvent.click(confirmButton);
  });

  expect(setRootPasswordFn).toHaveBeenCalledWith(password);

  await waitFor(() => {
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});

describe("when the password is not set", () => {
  it("displays a disabled remove button", async () => {
    authRender(<RootPassword />);
    const rootPassword = await screen.findByText(/Root password/i);
    const button = within(rootPassword).getByRole("button", { name: "is not set" });
    userEvent.click(button);

    const removeButton = await screen.findByRole("button", { name: "Do not use a password" });
    expect(removeButton).toBeDisabled();
  });
});

describe("when the password is set", () => {
  beforeEach(() => {
    isRootPasswordSetFn = () => Promise.resolve(true);
  });

  it("allows removing the password", async () => {
    authRender(<RootPassword />);
    const rootPassword = await screen.findByText(/Root password/i);
    const button = within(rootPassword).getByRole("button", { name: "is set" });
    userEvent.click(button);

    const removeButton = await screen.findByRole("button", { name: "Do not use a password" });
    userEvent.click(removeButton);

    expect(removeRootPasswordFn).toHaveBeenCalled();
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
  });
});

it("does not change the password if the user cancels", async () => {
  authRender(<RootPassword />);
  const rootPassword = await screen.findByText(/Root password/i);
  const button = within(rootPassword).getByRole("button", { name: "is not set" });
  userEvent.click(button);

  await screen.findByRole("dialog");
  const cancelButton = await screen.findByRole("button", { name: /Cancel/i });
  userEvent.click(cancelButton);

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
    authRender(<RootPassword />);
    const rootPassword = await screen.findByText(/Root password/i);
    const button = within(rootPassword).getByRole("button", { name: "is not set" });
    userEvent.click(button);

    await screen.findByRole("dialog");
    const cancelButton = await screen.findByRole("button", { name: /Cancel/i });
    userEvent.click(cancelButton);

    await screen.findByText(/Something went wrong/i);
  });
});
