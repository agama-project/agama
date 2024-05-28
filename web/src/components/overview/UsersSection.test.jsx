/*
 * Copyright (c) [2023] SUSE LLC
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
import { screen } from "@testing-library/react";
import { installerRender } from "~/test-utils";
import { UsersSection } from "~/components/overview";
import { createClient } from "~/client";

jest.mock("~/client");

const user = {
  fullName: "Jane Doe",
  userName: "jane",
  autologin: false
};
const testKey = "ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABgQDM+ test@example";

const getUserFn = jest.fn();
const isRootPasswordSetFn = jest.fn();
const getRootSSHKeyFn = jest.fn();

const userClientMock = {
  getUser: getUserFn,
  isRootPasswordSet: isRootPasswordSetFn,
  getRootSSHKey: getRootSSHKeyFn,
  getValidationErrors: jest.fn().mockResolvedValue([]),
  onValidationChange: jest.fn()
};

beforeEach(() => {
  getUserFn.mockResolvedValue(user);
  isRootPasswordSetFn.mockResolvedValue(true);
  getRootSSHKeyFn.mockResolvedValue(testKey);

  // if defined outside, the mock is cleared automatically
  createClient.mockImplementation(() => {
    return {
      onConnect: jest.fn(),
      onDisconnect: jest.fn(),
      users: {
        ...userClientMock,
      }
    };
  });
});

describe("when user is defined", () => {
  it("renders the username", async () => {
    installerRender(<UsersSection />);

    await screen.findByText("jane");
  });
});

describe("when user is not defined", () => {
  beforeEach(() => getUserFn.mockResolvedValue({ userName: "" }));

  it("renders information about it", async () => {
    installerRender(<UsersSection />);

    await screen.findByText(/No user defined/i);
  });
});

describe("when both root auth methods are set", () => {
  it("renders information about it", async () => {
    installerRender(<UsersSection />);

    await screen.findByText(/root.*set for using both/i);
  });
});

describe("when only root password is set", () => {
  beforeEach(() => getRootSSHKeyFn.mockResolvedValue(""));

  it("renders information about it", async () => {
    installerRender(<UsersSection />);

    await screen.findByText(/root.*set for using password/i);
  });
});

describe("when only public SSH Key is set", () => {
  beforeEach(() => isRootPasswordSetFn.mockResolvedValue(false));

  it("renders information about it", async () => {
    installerRender(<UsersSection />);

    await screen.findByText(/root.*set for using public SSH Key/i);
  });
});

describe("when none root auth method is set", () => {
  beforeEach(() => {
    isRootPasswordSetFn.mockResolvedValue(false);
    getRootSSHKeyFn.mockResolvedValue("");
  });

  it("renders information about it", async () => {
    installerRender(<UsersSection />);

    await screen.findByText("No root authentication method defined");
  });
});
