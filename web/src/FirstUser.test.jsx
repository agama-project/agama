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
import { createClient } from "./lib/client";
import FirstUser from "./FirstUser";

jest.mock("./lib/client");

let user;
const emptyUser = {
  fullName: "",
  userName: "",
  autologin: false
};

const setUserFn = jest.fn();
const removeUserFn = jest.fn();

beforeEach(() => {
  user = emptyUser;
  createClient.mockImplementation(() => {
    return {
      users: {
        setUser: setUserFn,
        removeUser: removeUserFn,
        getUser: jest.fn().mockResolvedValue(user)
      }
    };
  });
});

it("allows defining a new user", async () => {
  authRender(<FirstUser />);
  const firstUser = await screen.findByText(/A user/);
  const button = within(firstUser).getByRole("button", { name: "is not defined" });
  userEvent.click(button);

  await screen.findByRole("dialog");

  const fullNameInput = screen.getByLabelText("Full name");
  userEvent.type(fullNameInput, "Jane Doe");

  const usernameInput = screen.getByLabelText("Username");
  userEvent.type(usernameInput, "jane");

  const passwordInput = screen.getByLabelText("Password");
  userEvent.type(passwordInput, "12345");

  const confirmButton = screen.getByRole("button", { name: /Confirm/i });
  expect(confirmButton).toBeEnabled();
  userEvent.click(confirmButton);

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

it("does not change anything if the user cancels", async () => {
  authRender(<FirstUser />);
  const firstUser = await screen.findByText(/A user/);
  const button = within(firstUser).getByRole("button", { name: "is not defined" });
  userEvent.click(button);

  await screen.findByRole("dialog");

  const cancelButton = screen.getByRole("button", { name: /Cancel/i });
  userEvent.click(cancelButton);

  expect(setUserFn).not.toHaveBeenCalled();
  await waitFor(() => {
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
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
    authRender(<FirstUser />);
    const button = await screen.findByRole("button", { name: "jdoe" });
    userEvent.click(button);

    await screen.findByRole("dialog");

    const removeButton = screen.getByRole("button", { name: "Do not create a user" });
    userEvent.click(removeButton);

    expect(removeUserFn).toHaveBeenCalled();
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
  });
});
