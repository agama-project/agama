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
import { act, screen, waitFor } from "@testing-library/react";
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
const getValidationErrorsFn = jest.fn().mockResolvedValue([]);
const onValidationChangeFn = jest.fn();

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
        onStatusChange: jest.fn(),
        getValidationErrors: getValidationErrorsFn,
        onValidationChange: onValidationChangeFn
      },
      manager: {
        getStatus: jest.fn().mockResolvedValue(IDLE),
        onStatusChange: jest.fn()
      }
    };
  });
});

describe("when the user selects another disk", () => {
  it("changes the selected disk", async () => {
    calculateStorageProposalFn = jest.fn().mockResolvedValue(0);

    const { user } = installerRender(<Storage />);
    const button = await screen.findByRole("button", { name: "/dev/sda, 500 GiB" });
    await user.click(button);

    const targetSelector = await screen.findByLabelText("Device to install into");
    await user.selectOptions(targetSelector, ["/dev/sdb"]);
    await user.click(screen.getByRole("button", { name: "Confirm" }));

    await screen.findByRole("button", { name: "/dev/sdb, 650 GiB" });
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
    await screen.findByRole("button", { name: "/dev/sda, 500 GiB" });

    const [cb] = callbacks;
    act(() => {
      cb("/dev/sdb");
    });
    await screen.findByRole("button", { name: "/dev/sdb, 650 GiB" });
  });
});

describe("when the storage actions change", () => {
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
});

describe("when showError is set to true", () => {
  beforeEach(() => {
    getValidationErrorsFn.mockResolvedValue([{ message: "Could not make a proposal" }]);
  });

  it("displays the list of errors", async () => {
    installerRender(<Storage showErrors />);
    await waitFor(() => {
      expect(screen.queryByText(/Could not make a proposal/)).toBeInTheDocument();
    });
  });

  it("refreshes the list of errors when they change", async () => {
    let callback;
    onValidationChangeFn.mockImplementation(cb => { callback = cb });

    installerRender(<Storage showErrors />);
    act(() => {
      callback([{ message: "Could not find a suitable device" }]);
    });
    await waitFor(() => {
      expect(screen.queryByText(/Could not find a suitable device/)).toBeInTheDocument();
    });
  });
});
