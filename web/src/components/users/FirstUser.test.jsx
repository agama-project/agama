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

describe.skip("when the user is not defined yet", () => {
  beforeEach(() => {
    user = emptyUser;
  });

  it("allows defining a new user", async () => {
    const { user } = installerRender(<FirstUser />);
    await screen.findByText("No user defined yet.");
    await screen.findByText("Define a user now");
    // TODO: find a way to check that the button works as expected.
  });
});

describe.skip("when the user is already defined", () => {
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

  it("allows editing the user", async () => {
    const { user } = installerRender(<FirstUser />);

    await screen.findByText("John Doe");

    const userActionsToggler = screen.getByRole("button", { name: "Actions" });
    await user.click(userActionsToggler);
    const editAction = screen.getByRole("menuitem", { name: "Edit" });
    await user.click(editAction);
    await screen.findByRole("form");
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

describe.skip("when the user has been modified", () => {
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
