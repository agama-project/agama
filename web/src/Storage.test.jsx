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
import { act, screen } from "@testing-library/react";
import { installerRender } from "./test-utils";
import Storage from "./Storage";
import { createClient } from "./client";
import { IDLE } from "./client/status";

jest.mock("./client");
jest.mock("./InstallerSkeleton", () => () => "Loading storage");

let proposalSettings;
let storageActions;

let onActionsChangeFn = jest.fn();
let onStorageProposalChangeFn = jest.fn();
let calculateStorageProposalFn;
const getStatusFn = jest.fn().mockResolvedValue(IDLE);

const storageMock = {
  getStorageProposal: () => Promise.resolve(proposalSettings),
  getStorageActions: () => Promise.resolve(storageActions)
};

beforeEach(() => {
  storageActions = [{ text: "Mount /dev/sda1 as root", subvol: false, delete: false }];
  proposalSettings = {
    availableDevices: [
      { id: "/dev/sda", label: "/dev/sda, 500 GiB" },
      { id: "/dev/sdb", label: "/dev/sdb, 650 GiB" }
    ],
    candidateDevices: ["/dev/sda"],
    lvm: false
  };
  createClient.mockImplementation(() => {
    return {
      storage: {
        ...storageMock,
        calculateStorageProposal: calculateStorageProposalFn,
        onActionsChange: onActionsChangeFn,
        onStorageProposalChange: onStorageProposalChangeFn,
        getStatus: getStatusFn.mockResolvedValue(IDLE),
        onStatusChange: jest.fn()
      },
      manager: {
        getStatus: jest.fn().mockResolvedValue(IDLE),
        onStatusChange: jest.fn()
      }
    };
  });
});

describe("when there is a proposal", () => {
  it("displays the proposal", async () => {
    installerRender(<Storage />);
    await screen.findByText("Mount /dev/sda1 as root");
  });
});

describe("when there is no proposal", () => {
  beforeEach(() => {
    storageActions = [];
  });

  it("reports an error", async () => {
    installerRender(<Storage />);
    await screen.findByText("Cannot make a proposal for /dev/sda");
  });
});

describe("when the user selects another disk", () => {
  it("changes the selected disk", async () => {
    calculateStorageProposalFn = jest.fn().mockResolvedValue(0);

    const { user } = installerRender(<Storage />);
    const button = await screen.findByRole("button", { name: "/dev/sda" });
    await user.click(button);

    const targetSelector = await screen.findByLabelText("Device to install into");
    await user.selectOptions(targetSelector, ["/dev/sdb"]);
    await user.click(screen.getByRole("button", { name: "Confirm" }));

    await screen.findByRole("button", { name: "/dev/sdb" });
    expect(calculateStorageProposalFn).toHaveBeenCalledWith({
      candidateDevices: ["/dev/sdb"]
    });
  });
});

describe("when the storage proposal changes", () => {
  let callbacks;

  beforeEach(() => {
    callbacks = [];
    onStorageProposalChangeFn = cb => callbacks.push(cb);
  });

  it("updates the proposal", async () => {
    installerRender(<Storage />);
    await screen.findByRole("button", { name: "/dev/sda" });

    const [cb] = callbacks;
    act(() => {
      cb("/dev/sdb");
    });
    await screen.findByRole("button", { name: "/dev/sdb" });
  });
});

describe("when the storage actions changes", () => {
  let callbacks;

  beforeEach(() => {
    callbacks = [];
    onActionsChangeFn = cb => callbacks.push(cb);
  });

  it("updates the proposal", async () => {
    installerRender(<Storage />);
    await screen.findByText("Mount /dev/sda1 as root");

    const [cb] = callbacks;
    act(() => {
      cb([{ text: "Mount /dev/sdb1 as root", subvol: false }]);
    });
    await screen.findByText("Mount /dev/sdb1 as root");
  });

  it("reports an error when there are no actions", async () => {
    installerRender(<Storage />);
    await screen.findByText("Mount /dev/sda1 as root");

    const [cb] = callbacks;
    act(() => cb([]));
    await screen.findByText("Cannot make a proposal for /dev/sda");
  });
});

describe("when there are not devices for installation", () => {
  beforeEach(() => {
    storageActions = [];
    proposalSettings = {
      availableDevices: [],
      candidateDevices: [],
      lvm: false
    };
  });

  it("reports an error", async() => {
    installerRender(<Storage />);
    await screen.findByText("Cannot find a suitable storage device for installation");
  });
});
