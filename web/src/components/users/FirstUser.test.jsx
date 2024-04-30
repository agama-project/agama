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
import { FirstUser } from "~/components/users";

jest.mock("~/client");

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

const openUserForm = async () => {
  const { user } = installerRender(<FirstUser />);
  await screen.findByText("No user defined yet.");
  const button = await screen.findByRole("button", { name: "Define a user now" });
  await user.click(button);
  const dialog = await screen.findByRole("dialog");

  return { user, dialog };
};

beforeEach(() => {
  user = emptyUser;
  createClient.mockImplementation(() => {
    return {
      users: {
        setUser: setUserFn,
        getUser: jest.fn().mockResolvedValue(user),
        removeUser: removeUserFn,
        onUsersChange: onUsersChangeFn
      }
    };
  });
});

it("allows defining a new user", async () => {
  const { user } = installerRender(<FirstUser />);
  await screen.findByText("No user defined yet.");
  const button = await screen.findByRole("button", { name: "Define a user now" });
  await user.click(button);

  const dialog = await screen.findByRole("dialog");

  const fullNameInput = within(dialog).getByLabelText("Full name");
  await user.type(fullNameInput, "Jane Doe");

  const usernameInput = within(dialog).getByLabelText(/Username/);
  await user.type(usernameInput, "jane");

  const passwordInput = within(dialog).getByLabelText("Password");
  await user.type(passwordInput, "12345");

  const passwordConfirmationInput = within(dialog).getByLabelText("Password confirmation");
  await user.type(passwordConfirmationInput, "12345");

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
  const button = await screen.findByRole("button", { name: "Define a user now" });
  await user.click(button);

  const dialog = await screen.findByRole("dialog");

  const usernameInput = within(dialog).getByLabelText(/Username/);
  await user.type(usernameInput, "jane");
  const confirmButton = within(dialog).getByRole("button", { name: /Confirm/i });
  expect(confirmButton).toBeDisabled();
});

it("does not change anything if the user cancels", async () => {
  const { user } = installerRender(<FirstUser />);
  const button = await screen.findByRole("button", { name: "Define a user now" });
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
    const button = await screen.findByRole("button", { name: "Define a user now" });
    await user.click(button);

    const dialog = await screen.findByRole("dialog");

    const usernameInput = within(dialog).getByLabelText("Username");
    await user.type(usernameInput, "root");

    const passwordInput = within(dialog).getByLabelText("Password");
    await user.type(passwordInput, "12345");

    const passwordConfirmationInput = within(dialog).getByLabelText("Password confirmation");
    await user.type(passwordConfirmationInput, "12345");

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
      expect(screen.queryByText("No user defined yet.")).toBeInTheDocument();
    });
  });
});

describe("when the user is already defined", () => {
  beforeEach(() => {
    user = {
      fullName: "John Doe",
      userName: "jdoe",
      password: "sup3rSecret",
      autologin: false
    };
  });

  it("renders the name and username", async () => {
    installerRender(<FirstUser />);
    await screen.findByText("John Doe");
    await screen.findByText("jdoe");
  });

  it("allows editing the user without changing the password", async () => {
    const { user } = installerRender(<FirstUser />);

    await screen.findByText("John Doe");

    const userActionsToggler = screen.getByRole("button", { name: "Actions" });
    await user.click(userActionsToggler);
    const editAction = screen.getByRole("menuitem", { name: "Edit" });
    await user.click(editAction);
    const dialog = await screen.findByRole("dialog");

    const fullNameInput = within(dialog).getByLabelText("Full name");
    await user.clear(fullNameInput);
    await user.type(fullNameInput, "Jane");

    const usernameInput = within(dialog).getByLabelText(/Username/);
    await user.clear(usernameInput);
    await user.type(usernameInput, "jane");

    const autologinCheckbox = within(dialog).getByLabelText(/Auto-login/);
    await user.click(autologinCheckbox);

    const confirmButton = screen.getByRole("button", { name: /Confirm/i });
    expect(confirmButton).toBeEnabled();
    await user.click(confirmButton);

    expect(setUserFn).toHaveBeenCalledWith({
      fullName: "Jane",
      userName: "jane",
      password: "sup3rSecret",
      autologin: true
    });
  });

  it("allows changing the password", async () => {
    const { user } = installerRender(<FirstUser />);

    await screen.findByText("John Doe");

    const userActionsToggler = screen.getByRole("button", { name: "Actions" });
    await user.click(userActionsToggler);
    const editAction = screen.getByRole("menuitem", { name: "Edit" });
    await user.click(editAction);
    const dialog = await screen.findByRole("dialog");

    const confirmButton = screen.getByRole("button", { name: /Confirm/i });
    const changePasswordCheckbox = within(dialog).getByLabelText("Edit password too");
    await user.click(changePasswordCheckbox);

    expect(confirmButton).toBeDisabled();

    const passwordInput = within(dialog).getByLabelText("Password");
    await user.type(passwordInput, "n0tSecret");
    const passwordConfirmationInput = within(dialog).getByLabelText("Password confirmation");
    await user.type(passwordConfirmationInput, "n0tSecret");

    expect(confirmButton).toBeEnabled();

    await user.click(confirmButton);

    expect(setUserFn).toHaveBeenCalledWith({
      fullName: "John Doe",
      userName: "jdoe",
      password: "n0tSecret",
      autologin: false
    });
  });

  it("allows removing the user", async () => {
    const { user } = installerRender(<FirstUser />);
    const table = await screen.findByRole("grid");
    const row = within(table).getByText("John Doe")
      .closest("tr");
    const actionsToggler = within(row).getByRole("button", { name: "Actions" });
    await user.click(actionsToggler);
    const discardAction = screen.getByRole("menuitem", { name: "Discard" });
    await user.click(discardAction);
    expect(removeUserFn).toHaveBeenCalled();
  });
});

describe("when the user has been modified", () => {
  it("updates the UI for rendering its main info", async () => {
    const [mockFunction, callbacks] = createCallbackMock();
    onUsersChangeFn = mockFunction;
    installerRender(<FirstUser />);
    await screen.findByText("No user defined yet.");

    const [cb] = callbacks;
    act(() => {
      cb({ firstUser: { userName: "ytm", fullName: "YaST Team Member", autologin: false } });
    });

    const noUserInfo = await screen.queryByText("No user defined yet.");
    expect(noUserInfo).toBeNull();
    screen.getByText("YaST Team Member");
    screen.getByText("ytm");
  });
});

describe("username suggestions", () => {
  it("shows suggestions when full name is given and username gets focus", async () => {
    const { user, dialog } = await openUserForm();

    const fullNameInput = within(dialog).getByLabelText("Full name");
    await user.type(fullNameInput, "Jane Doe");

    await user.tab();

    const menuItems = screen.getAllByText("Use suggested username");
    expect(menuItems.length).toBe(4);
  });

  it("hides suggestions when username loses focus", async () => {
    const { user, dialog } = await openUserForm();

    const fullNameInput = within(dialog).getByLabelText("Full name");
    await user.type(fullNameInput, "Jane Doe");
    
    await user.tab();

    let menuItems = screen.getAllByText("Use suggested username");
    expect(menuItems.length).toBe(4);

    await user.tab();

    menuItems = screen.queryAllByText("Use suggested username");
    expect(menuItems.length).toBe(0);
  });

  it("does not show suggestions when full name is not given", async () => {
    const { user, dialog } = await openUserForm();

    const fullNameInput = within(dialog).getByLabelText("Full name");
    fullNameInput.focus();

    await user.tab();

    const menuItems = screen.queryAllByText("Use suggested username");
    expect(menuItems.length).toBe(0);
  });

  it("hides suggestions if user types something", async () => {
    const { user, dialog } = await openUserForm();

    const fullNameInput = within(dialog).getByLabelText("Full name");
    await user.type(fullNameInput, "Jane Doe");

    await user.tab();

    // confirming that we have suggestions
    let menuItems = screen.queryAllByText("Use suggested username");
    expect(menuItems.length).toBe(4);

    const usernameInput = within(dialog).getByLabelText("Username");
    // the user now types something
    await user.type(usernameInput, "John Smith");

    // checking if suggestions are gone
    menuItems = screen.queryAllByText("Use suggested username");
    expect(menuItems.length).toBe(0);
  });

  it("fills username input with chosen suggestion", async () => {
    const { user, dialog } = await openUserForm();

    const fullNameInput = within(dialog).getByLabelText("Full name");
    await user.type(fullNameInput, "Will Power");

    await user.tab();

    const menuItem = screen.getByText('willpower');
    const usernameInput = within(dialog).getByLabelText("Username");
    
    await user.click(menuItem);

    expect(usernameInput).toHaveFocus();
    expect(usernameInput.value).toBe("willpower");
  });

  it("fills username input with chosen suggestion using keyboard for selection", async () => {
    const { user, dialog } = await openUserForm();

    const fullNameInput = within(dialog).getByLabelText("Full name");
    await user.type(fullNameInput, "Jane Doe");

    await user.tab();

    const menuItems = screen.getAllByRole("menuitem");
    const menuItemTwo = menuItems[1].textContent.replace("Use suggested username ", "");

    await user.keyboard("{ArrowDown}");
    await user.keyboard("{ArrowDown}");
    await user.keyboard("{Enter}");

    const usernameInput = within(dialog).getByLabelText("Username");
    expect(usernameInput).toHaveFocus();
    expect(usernameInput.value).toBe(menuItemTwo);
  });
});
