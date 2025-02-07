/*
 * Copyright (c) [2025] SUSE LLC
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
import { screen, within } from "@testing-library/react";
import { plainRender } from "~/test-utils";
import AddExistingDeviceMenu from "~/components/storage/AddExistingDeviceMenu";
import { StorageDevice } from "~/types/storage";
import * as ConfigModel from "~/api/storage/types/config-model";

const vda: StorageDevice = {
  sid: 59,
  type: "disk",
  isDrive: true,
  description: "",
  vendor: "Micron",
  model: "Micron 1100 SATA",
  driver: ["ahci", "mmcblk"],
  bus: "IDE",
  name: "/dev/vda",
  size: 1e12,
  systems: ["Windows 11", "openSUSE Leap 15.2"],
};

const vdb: StorageDevice = {
  sid: 60,
  type: "disk",
  isDrive: true,
  description: "",
  vendor: "Seagate",
  model: "Unknown",
  driver: ["ahci", "mmcblk"],
  bus: "IDE",
  name: "/dev/vdb",
  size: 1e6,
  systems: [],
};

const vdaDrive: ConfigModel.Drive = {
  name: "/dev/vda",
  spacePolicy: "delete",
  partitions: [],
};

const vdbDrive: ConfigModel.Drive = {
  name: "/dev/vdb",
  spacePolicy: "delete",
  partitions: [],
};

const mockUseConfigModelFn = jest.fn();
const mockAddDriveFn = jest.fn();

jest.mock("~/queries/storage", () => ({
  ...jest.requireActual("~/queries/storage"),
  useConfigModel: () => mockUseConfigModelFn(),
  useAvailableDevices: () => [vda, vdb],
  useModel: () => ({ addDrive: mockAddDriveFn }),
}));

describe("when there are unused disks", () => {
  beforeEach(() => {
    mockUseConfigModelFn.mockReturnValue({ drives: [] });
  });

  it("renders the menu", async () => {
    plainRender(<AddExistingDeviceMenu />);
    expect(screen.queryByText(/Use additional disk/)).toBeInTheDocument();
  });

  it("allows users to add a new drive", async () => {
    const { user } = plainRender(<AddExistingDeviceMenu />);

    const button = screen.getByRole("button", { name: /Use additional/ });
    await user.click(button);
    const devicesMenu = screen.getByRole("menu");
    const vdaItem = within(devicesMenu).getByRole("menuitem", { name: /vda/ });
    await user.click(vdaItem);
    expect(mockAddDriveFn).toHaveBeenCalled();
  });
});

describe("when there are no more unused disks", () => {
  beforeEach(() => {
    mockUseConfigModelFn.mockReturnValue({ drives: [vdaDrive, vdbDrive] });
  });

  it("renders nothing", async () => {
    plainRender(<AddExistingDeviceMenu />);
    expect(screen.queryByText(/Use additional disk/)).toBeNull();
  });
});
