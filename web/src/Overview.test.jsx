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
import { installerRender } from "./test-utils";
import Overview from "./Overview";
import { createClient } from "./client";

jest.mock("./client");

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
const ipData = {
  addresses: [],
  hostname: "example.net"
}

beforeEach(() => {
  createClient.mockImplementation(() => {
    return {
      storage: {
        getStorageProposal: () => Promise.resolve(proposal),
        getStorageActions: () => Promise.resolve(actions),
        onActionsChange: jest.fn(),
        onStorageProposalChange: jest.fn()
      },
      language: {
        getLanguages: () => Promise.resolve(languages),
        getSelectedLanguages: () => Promise.resolve(["en_US"]),
        onLanguageChange: jest.fn()
      },
      software: {
        getProducts: () => Promise.resolve(products),
        getSelectedProduct: () => Promise.resolve("openSUSE"),
        onProductChange: jest.fn()
      },
      manager: {
        startInstallation: startInstallationFn
      },
      network: {
        config: () => Promise.resolve(ipData)
      },
      users: {
        getUser: () => Promise.resolve(fakeUser),
        isRootPasswordSet: () => Promise.resolve(true),
        getRootSSHKey: () => Promise.resolve("ssh-rsa"),
        onUsersChange: jest.fn()
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

describe("when the user clicks 'Install'", () => {
  const prepareScenario = async () => {
    const { user } = installerRender(<Overview />);

    // TODO: we should have some UI element to tell the user we have finished
    // with loading data.
    await screen.findByText("English");

    await user.click(screen.getByRole("button", { name: /Install/ }));

    const dialog = await screen.findByRole("dialog");

    return {
      user,
      dialog
    };
  };

  it("asks for confirmation", async () => {
    const { dialog } = await prepareScenario();
    const title = within(dialog).getByText(/Confirm Installation/i);

    expect(title).toBeDefined();
  });

  it("starts the installation if the user confirms", async () => {
    const { dialog, user } = await prepareScenario();
    const button = within(dialog).getByRole("button", { name: /Install/i });
    await user.click(button);

    expect(startInstallationFn).toBeCalled();
  });

  it("does not start the installation if the user cancels", async () => {
    const { dialog, user } = await prepareScenario();
    const button = within(dialog).getByRole("button", { name: /Cancel/i });
    await user.click(button);

    expect(startInstallationFn).not.toBeCalled();

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
  });
});
