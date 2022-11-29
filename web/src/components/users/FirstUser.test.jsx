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
import { FirstUser } from "@components/users";

jest.mock("@client");

let user;
const emptyUser = {
  fullName: "",
  userName: "",
  autologin: false
};

let setUserResult = { result: true, issues: [] };

let setUserFn = jest.fn().mockResolvedValue(setUserResult);
const removeUserFn = jest.fn();
let onUsersChangeFn = jest.fn();

beforeEach(() => {
  user = emptyUser;
  createClient.mockImplementation(() => {
    return {
      users: {
        setUser: setUserFn,
        removeUser: removeUserFn,
        getUser: jest.fn().mockResolvedValue(user),
        onUsersChange: onUsersChangeFn
      }
    };
  });
});

it("allows defining a new user", async () => {
  const { user } = installerRender(<FirstUser />);
  const firstUser = await screen.findByText(/A user/);
  const button = within(firstUser).getByRole("button", { name: "is not defined" });
  await user.click(button);

  const dialog = await screen.findByRole("dialog");

  const fullNameInput = within(dialog).getByLabelText("Full name");
  await user.type(fullNameInput, "Jane Doe");

  const usernameInput = within(dialog).getByLabelText(/Username/);
  await user.type(usernameInput, "jane");

  const passwordInput = within(dialog).getByLabelText(/Password/);
  await user.type(passwordInput, "12345");

  const confirmButton = screen.getByRole("button", { name: /Confirm/i });
  expect(confirmButton).toBeEnabled();
  await user.click(confirmButton);

  expect(setUserFn).toHaveBeenCalledWith({
    fullName: "Jane Doe",
    userName: "jane",
    password: "12345",
    autologin: false
  });

  await waitFor(() => {
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});

it("doest not allow to confirm the settings if the user name and the password are not provided", async () => {
  const { user } = installerRender(<FirstUser />);
  const firstUser = await screen.findByText(/A user/);
  const button = within(firstUser).getByRole("button", { name: "is not defined" });
  await user.click(button);

  const dialog = await screen.findByRole("dialog");

  const usernameInput = within(dialog).getByLabelText(/Username/);
  await user.type(usernameInput, "jane");
  const confirmButton = within(dialog).getByRole("button", { name: /Confirm/i });
  expect(confirmButton).toBeDisabled();
});

it("does not change anything if the user cancels", async () => {
  const { user } = installerRender(<FirstUser />);
  const firstUser = await screen.findByText(/A user/);
  const button = within(firstUser).getByRole("button", { name: "is not defined" });
  await user.click(button);

  const dialog = await screen.findByRole("dialog");

  const cancelButton = within(dialog).getByRole("button", { name: /Cancel/i });
  await user.click(cancelButton);

  expect(setUserFn).not.toHaveBeenCalled();
  await waitFor(() => {
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});

describe("when there is some issue with the user config provided", () => {
  beforeEach(() => {
    setUserResult = { result: false, issues: ["There is an error"] };
    setUserFn = jest.fn().mockResolvedValue(setUserResult);
  });

  it("shows the issues found", async () => {
    const { user } = installerRender(<FirstUser />);
    const firstUser = await screen.findByText(/A user/);
    const button = within(firstUser).getByRole("button", { name: "is not defined" });
    await user.click(button);

    const dialog = await screen.findByRole("dialog");

    const usernameInput = within(dialog).getByLabelText("Username");
    await user.type(usernameInput, "root");

    const passwordInput = within(dialog).getByLabelText(/Password/);
    await user.type(passwordInput, "12345");

    const confirmButton = within(dialog).getByRole("button", { name: /Confirm/i });
    expect(confirmButton).toBeEnabled();
    await user.click(confirmButton);

    expect(setUserFn).toHaveBeenCalledWith({
      fullName: "",
      userName: "root",
      password: "12345",
      autologin: false
    });

    await waitFor(() => {
      expect(screen.queryByText(/Something went wrong/i)).toBeInTheDocument();
      expect(screen.queryByText(/There is an error/i)).toBeInTheDocument();
      expect(screen.queryByText(/is not defined/i)).toBeInTheDocument();
    });
  });
});

describe("when the first user is already defined", () => {
  beforeEach(() => {
    user = {
      fullName: "John",
      userName: "jdoe",
      autologin: false
    };
  });

  it("allows removing the user", async () => {
    const { user } = installerRender(<FirstUser />);
    const button = await screen.findByRole("button", { name: "jdoe" });
    await user.click(button);

    const dialog = await screen.findByRole("dialog");

    const removeButton = within(dialog).getByRole("button", { name: "Do not create a user" });
    await user.click(removeButton);

    expect(removeUserFn).toHaveBeenCalled();
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
  });
});

describe("when the Users change", () => {
  describe("and the FirstUser has been modified", () => {
    it("updates the proposal first User description", async () => {
      const [mockFunction, callbacks] = createCallbackMock();
      onUsersChangeFn = mockFunction;

      installerRender(<FirstUser />);

      let firstUser = await screen.findByText(/A user/i);
      within(firstUser).getByRole("button", { name: "is not defined" });

      const [cb] = callbacks;
      act(() => {
        cb({ firstUser: { userName: "yast", fullName: "YaST", autologin: false } });
      });

      firstUser = await screen.findByText(/User/i);
      within(firstUser).getByRole("button", { name: "yast" });
      within(firstUser).findByText("is defined");
    });
  });
});
