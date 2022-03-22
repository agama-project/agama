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
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { installerRender } from "./test-utils";
import Overview from "./Overview";
import { createClient } from "./lib/client";

jest.mock("./lib/client");

const proposal = {
  candidateDevices: ["/dev/sda"],
  availableDevices: [
    { id: "/dev/sda", label: "/dev/sda, 500 GiB" },
    { id: "/dev/sdb", label: "/dev/sdb, 650 GiB" }
  ],
  lvm: false
};
const actions = [{ text: "Mount /dev/sda1 as root", subvol: false }];
const languages = [{ id: "en_US", name: "English" }];
const products = [{ id: "openSUSE", name: "openSUSE Tumbleweed" }];
const startInstallationFn = jest.fn();
const fakeUser = { fullName: "Fake User", userName: "fake_user", autologin: true };

beforeEach(() => {
  createClient.mockImplementation(() => {
    return {
      storage: {
        getStorageProposal: () => Promise.resolve(proposal),
        getStorageActions: () => Promise.resolve(actions),
        onActionsChange: jest.fn()
      },
      language: {
        getLanguages: () => Promise.resolve(languages),
        getSelectedLanguages: () => Promise.resolve(["en_US"])
      },
      software: {
        getProducts: () => Promise.resolve(products),
        getSelectedProduct: () => Promise.resolve("openSUSE")
      },
      manager: {
        startInstallation: startInstallationFn
      },
      users: {
        getUser: () => Promise.resolve(fakeUser),
        isRootPassword: jest.fn(),
        rootSSHKey: jest.fn()
      }
    };
  });
});

test("renders the Overview", async () => {
  installerRender(<Overview />);
  const title = screen.getByText(/Installation Summary/i);
  expect(title).toBeInTheDocument();

  await screen.findByText("English");
  await screen.findByText("/dev/sda");
  await screen.findByText("openSUSE Tumbleweed");
});

test("starts the installation when the user clicks 'Install'", async () => {
  installerRender(<Overview />);

  // TODO: we should have some UI element to tell the user we have finished
  // with loading data.
  await screen.findByText("English");

  userEvent.click(screen.getByRole("button", { name: /Install/ }));
  expect(startInstallationFn).toHaveBeenCalled();
});
