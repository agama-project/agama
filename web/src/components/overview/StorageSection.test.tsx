/*
 * Copyright (c) [2022-2025] SUSE LLC
 *
 * All Rights Reserved.
 *
 * This program is free software; you can redistribute it and/or modify it
 * under the terms of the GNU General Public License as published by the Free
 * Software Foundation; either version 2 of the License, or (at your option)
 * any later version.
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
import { plainRender } from "~/test-utils";
import { StorageSection } from "~/components/overview";
import * as ConfigModel from "~/api/storage/types/config-model";

const sdaDrive: ConfigModel.Drive = {
  name: "/dev/sda",
  spacePolicy: "delete",
  partitions: [],
};

const sdbDrive: ConfigModel.Drive = {
  name: "/dev/sdb",
  spacePolicy: "delete",
  partitions: [],
};

const mockDevices = [
  { name: "/dev/sda", size: 536870912000 },
  { name: "/dev/sdb", size: 697932185600 },
];

const mockUseConfigModelFn = jest.fn();

jest.mock("~/queries/storage", () => ({
  ...jest.requireActual("~/queries/storage"),
  useDevices: () => mockDevices,
}));

jest.mock("~/queries/storage/config-model", () => ({
  ...jest.requireActual("~/queries/storage/config-model"),
  useConfigModel: () => mockUseConfigModelFn(),
}));

describe("when the configuration does not include any device", () => {
  beforeEach(() => {
    mockUseConfigModelFn.mockReturnValue({ drives: [] });
  });

  it("indicates that a device is not selected", async () => {
    plainRender(<StorageSection />);

    await screen.findByText(/No device selected/);
  });
});

describe("when the configuration contains one drive", () => {
  beforeEach(() => {
    mockUseConfigModelFn.mockReturnValue({ drives: [sdaDrive] });
  });

  it("renders the proposal summary", async () => {
    plainRender(<StorageSection />);

    await screen.findByText(/Install using device/);
    await screen.findByText(/\/dev\/sda, 500 GiB/);
    await screen.findByText(/and deleting all its content/);
  });

  describe("and the space policy is set to 'resize'", () => {
    beforeEach(() => {
      mockUseConfigModelFn.mockReturnValue({ drives: [{ ...sdaDrive, spacePolicy: "resize" }] });
    });

    it("indicates that partitions may be shrunk", async () => {
      plainRender(<StorageSection />);

      await screen.findByText(/shrinking existing partitions as needed/);
    });
  });

  describe("and the space policy is set to 'keep'", () => {
    beforeEach(() => {
      mockUseConfigModelFn.mockReturnValue({ drives: [{ ...sdaDrive, spacePolicy: "keep" }] });
    });

    it("indicates that partitions will be kept", async () => {
      plainRender(<StorageSection />);

      await screen.findByText(/without modifying existing partitions/);
    });
  });

  describe("and the space policy is set to 'custom'", () => {
    beforeEach(() => {
      mockUseConfigModelFn.mockReturnValue({ drives: [{ ...sdaDrive, spacePolicy: "custom" }] });
    });

    it("indicates that custom strategy for allocating space is set", async () => {
      plainRender(<StorageSection />);

      await screen.findByText(/custom strategy to find the needed space/);
    });
  });

  describe("and the drive matches no disk", () => {
    beforeEach(() => {
      mockUseConfigModelFn.mockReturnValue({ drives: [{ ...sdaDrive, name: null }] });
    });

    it("indicates that a device is not selected", async () => {
      plainRender(<StorageSection />);

      await screen.findByText(/No device selected/);
    });
  });
});

describe("when the configuration contains several drives", () => {
  beforeEach(() => {
    mockUseConfigModelFn.mockReturnValue({ drives: [sdaDrive, sdbDrive] });
  });

  it("renders the proposal summary", async () => {
    plainRender(<StorageSection />);

    await screen.findByText(/Install using several devices/);
    await screen.findByText(/and deleting all its content/);
  });

  describe("but one of them has a different space policy", () => {
    beforeEach(() => {
      mockUseConfigModelFn.mockReturnValue({
        drives: [sdaDrive, { ...sdbDrive, spacePolicy: "resize" }],
      });
    });

    it("indicates that custom strategy for allocating space is set", async () => {
      plainRender(<StorageSection />);

      await screen.findByText(/custom strategy to find the needed space/);
    });
  });
});
