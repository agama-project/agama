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

import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { authRender } from "./test-utils";
import { createClient } from "./lib/client";

import RootPassword from "./RootPassword";

jest.mock("./lib/client");

let isRootPasswordFn = () => false;
let getRootSSHKeyFn = () => "";

beforeEach(() => {
  createClient.mockImplementation(() => {
    return {
      users: {
        isRootPassword: isRootPasswordFn,
        getRootSSHKey: getRootSSHKeyFn
      }
    };
  });
});

describe("RootPassword", () => {
  it("displays a form set or change root password when user clicks the link", async () => {
    authRender(<RootPassword />);

    const rootPassword = await screen.findByText(/Root password/i);
    const passwordLink = within(rootPassword).getByRole("button", { name: "is not set" });
    userEvent.click(passwordLink);
    await screen.findByRole("dialog");
    await screen.findByText(/Root Configuration/i);
  });

  describe("when the root password is not set", () => {
    beforeEach(() => {
      isRootPasswordFn = () => false;
    });

    it("displays a link to set the root password", async () => {
      authRender(<RootPassword />);
      const rootPassword = await screen.findByText(/Root password/i);
      const button = within(rootPassword).getByRole("button", { name: "is not set" });
      expect(button).toBeInTheDocument();
    });
  });

  describe("when the root password is set", () => {
    beforeEach(() => {
      isRootPasswordFn = () => true;
    });

    it("displays a link to change the root password", async () => {
      authRender(<RootPassword />);
      const rootPassword = await screen.findByText(/Root password/i);
      const button = within(rootPassword).getByRole("button", { name: "is set" });
      expect(button).toBeInTheDocument();
    });
  });
});
