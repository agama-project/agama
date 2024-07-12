/*
 * Copyright (c) [2022-2024] SUSE LLC
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
import { createClient } from "~/client";
import { StorageSection } from "~/components/overview";

jest.mock("~/client");

const availableDevices = [
  { name: "/dev/sda", size: 536870912000 },
  { name: "/dev/sdb", size: 697932185600 },
];

const proposalResult = {
  settings: {
    target: "disk",
    targetDevice: "/dev/sda",
    spacePolicy: "delete",
  },
  actions: [],
};

const storageMock = {
  probe: jest.fn().mockResolvedValue(0),
  proposal: {
    getAvailableDevices: jest.fn().mockResolvedValue(availableDevices),
    getResult: jest.fn().mockResolvedValue(proposalResult),
  },
  onStatusChange: jest.fn(),
};

let storage;

beforeEach(() => {
  storage = { ...storageMock, proposal: { ...storageMock.proposal } };

  createClient.mockImplementation(() => ({ storage }));
});

describe("when there is a proposal", () => {
  it("renders the proposal summary", async () => {
    installerRender(<StorageSection />);

    await screen.findByText(/Install using device/);
    await screen.findByText(/\/dev\/sda, 500 GiB/);
    await screen.findByText(/and deleting all its content/);
  });

  describe("and the space policy is set to 'resize'", () => {
    beforeEach(() => {
      const result = { settings: { spacePolicy: "resize", targetDevice: "/dev/sda" } };
      storage.proposal.getResult = jest.fn().mockResolvedValue(result);
    });

    it("indicates that partitions may be shrunk", async () => {
      installerRender(<StorageSection />);

      await screen.findByText(/shrinking existing partitions as needed/);
    });
  });

  describe("and the space policy is set to 'keep'", () => {
    beforeEach(() => {
      const result = { settings: { spacePolicy: "keep", targetDevice: "/dev/sda" } };
      storage.proposal.getResult = jest.fn().mockResolvedValue(result);
    });

    it("indicates that partitions will be kept", async () => {
      installerRender(<StorageSection />);

      await screen.findByText(/without modifying existing partitions/);
    });
  });

  describe("and there is no target device", () => {
    beforeEach(() => {
      const result = { settings: { targetDevice: "" } };
      storage.proposal.getResult = jest.fn().mockResolvedValue(result);
    });

    it("indicates that a device is not selected", async () => {
      installerRender(<StorageSection />);

      await screen.findByText(/No device selected/);
    });
  });
});
