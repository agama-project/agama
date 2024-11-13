/*
 * Copyright (c) [2022-2024] SUSE LLC
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
import * as ConfigModel from "~/storage/model/config";

const mockDevices = [
  { name: "/dev/sda", size: 536870912000 },
  { name: "/dev/sdb", size: 697932185600 },
];

const mockConfig = { devices: [] as ConfigModel.Device[] };

jest.mock("~/queries/storage", () => ({
  ...jest.requireActual("~/queries/storage"),
  useDevices: () => mockDevices,
  useConfigDevices: () => mockConfig.devices,
}));

describe("when the configuration does not include any device", () => {
  beforeEach(() => {
    mockConfig.devices = [];
  });

  it("indicates that a device is not selected", async () => {
    plainRender(<StorageSection />);

    await screen.findByText(/No device selected/);
  });
});

describe("when the configuration contains one drive", () => {
  beforeEach(() => {
    mockConfig.devices = [{ name: "/dev/sda", spacePolicy: "delete" }];
  });

  it("renders the proposal summary", async () => {
    plainRender(<StorageSection />);

    await screen.findByText(/Install using device/);
    await screen.findByText(/\/dev\/sda, 500 GiB/);
    await screen.findByText(/and deleting all its content/);
  });

  describe("and the space policy is set to 'resize'", () => {
    beforeEach(() => {
      mockConfig.devices[0].spacePolicy = "resize";
    });

    it("indicates that partitions may be shrunk", async () => {
      plainRender(<StorageSection />);

      await screen.findByText(/shrinking existing partitions as needed/);
    });
  });

  describe("and the space policy is set to 'keep'", () => {
    beforeEach(() => {
      mockConfig.devices[0].spacePolicy = "keep";
    });

    it("indicates that partitions will be kept", async () => {
      plainRender(<StorageSection />);

      await screen.findByText(/without modifying existing partitions/);
    });
  });

  describe("and the drive matches no disk", () => {
    beforeEach(() => {
      mockConfig.devices[0].name = null;
    });

    it("indicates that a device is not selected", async () => {
      plainRender(<StorageSection />);

      await screen.findByText(/No device selected/);
    });
  });
});

describe("when the configuration contains several drives", () => {
  beforeEach(() => {
    mockConfig.devices = [
      { name: "/dev/sda", spacePolicy: "delete" },
      { name: "/dev/sdb", spacePolicy: "delete" },
    ];
  });

  it("renders the proposal summary", async () => {
    plainRender(<StorageSection />);

    await screen.findByText(/Install using several devices/);
    await screen.findByText(/and deleting all its content/);
  });
});
