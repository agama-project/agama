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
import { screen } from "@testing-library/react";
import { mockNavigateFn, plainRender } from "~/test-utils";
import ConfigureDeviceMenu from "./ConfigureDeviceMenu";
import { StorageDevice } from "~/types/storage";
import { apiModel } from "~/api/storage/types";

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

const vdaDrive: apiModel.Drive = {
  name: "/dev/vda",
  spacePolicy: "delete",
  partitions: [],
};

const vdbDrive: apiModel.Drive = {
  name: "/dev/vdb",
  spacePolicy: "delete",
  partitions: [],
};

const mockUseConfigModelFn = jest.fn();
const mockAddDriveFn = jest.fn();

jest.mock("~/queries/storage", () => ({
  ...jest.requireActual("~/queries/storage"),
  useAvailableDevices: () => [vda, vdb],
}));

jest.mock("~/queries/storage/config-model", () => ({
  useModel: () => ({ addDrive: mockAddDriveFn }),
  useConfigModel: () => mockUseConfigModelFn(),
}));

describe("ConfigureDeviceMenu", () => {
  beforeEach(() => {
    mockUseConfigModelFn.mockReturnValue({ drives: [] });
  });

  it("renders an initially closed menu ", async () => {
    const { user } = plainRender(<ConfigureDeviceMenu />);
    const toggler = screen.getByRole("button", { name: "More devices", expanded: false });
    expect(screen.queryAllByRole("menu").length).toBe(0);
    await user.click(toggler);
    expect(toggler).toHaveAttribute("aria-expanded", "true");
    expect(screen.queryAllByRole("menu").length).not.toBe(0);
  });

  it("allows users to add a new LVM volume group", async () => {
    const { user } = plainRender(<ConfigureDeviceMenu />);
    const toggler = screen.getByRole("button", { name: "More devices", expanded: false });
    await user.click(toggler);
    const lvmMenuItem = screen.getByRole("menuitem", { name: /LVM/ });
    await user.click(lvmMenuItem);
    expect(mockNavigateFn).toHaveBeenCalledWith("/storage/volume-groups/add");
  });

  describe("when there are unused disks", () => {
    describe("and no disks have been configured yet", () => {
      it("allows users to add a new drive", async () => {
        const { user } = plainRender(<ConfigureDeviceMenu />);
        const toggler = screen.getByRole("button", { name: /More devices/ });
        await user.click(toggler);
        const disksMenuItem = screen.getByRole("menuitem", { name: "Add device menu" });
        await user.click(disksMenuItem);
        const vdaItem = screen.getByRole("menuitem", { name: /vda/ });
        await user.click(vdaItem);
        expect(mockAddDriveFn).toHaveBeenCalled();
      });
    });

    describe("but some disks are already configured", () => {
      beforeEach(() => {
        mockUseConfigModelFn.mockReturnValue({ drives: [vdaDrive] });
      });

      it("allows users to add a new drive to an unused disk", async () => {
        const { user } = plainRender(<ConfigureDeviceMenu />);
        const toggler = screen.getByRole("button", { name: /More devices/ });
        await user.click(toggler);
        const disksMenuItem = screen.getByRole("menuitem", { name: "Add device menu" });
        await user.click(disksMenuItem);
        expect(screen.queryByRole("menuitem", { name: /vda/ })).toBeNull();
        const vdbItem = screen.getByRole("menuitem", { name: /vdb/ });
        await user.click(vdbItem);
        expect(mockAddDriveFn).toHaveBeenCalled();
      });
    });
  });

  describe("when there are no more unused disks", () => {
    beforeEach(() => {
      mockUseConfigModelFn.mockReturnValue({ drives: [vdaDrive, vdbDrive] });
    });

    it("renders the disks menu as disabled with an informative label", async () => {
      const { user } = plainRender(<ConfigureDeviceMenu />);
      const toggler = screen.getByRole("button", { name: /More devices/ });
      await user.click(toggler);
      const disksMenuItem = screen.getByRole("menuitem", { name: "Add device menu" });
      expect(disksMenuItem).toBeDisabled();
    });
  });
});
