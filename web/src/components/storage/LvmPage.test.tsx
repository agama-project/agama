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
import { installerRender, mockParams } from "~/test-utils";
import { model, StorageDevice } from "~/storage";
import { gib } from "./utils";
import LvmPage from "./LvmPage";

const sda1: StorageDevice = {
  sid: 69,
  name: "/dev/sda1",
  description: "Swap partition",
  isDrive: false,
  type: "partition",
  size: gib(2),
  shrinking: { unsupported: ["Resizing is not supported"] },
  start: 1,
};

const sda: StorageDevice = {
  sid: 59,
  isDrive: true,
  type: "disk",
  vendor: "Micron",
  model: "Micron 1100 SATA",
  driver: ["ahci", "mmcblk"],
  bus: "IDE",
  busId: "",
  transport: "usb",
  dellBOSS: false,
  sdCard: true,
  active: true,
  name: "/dev/sda",
  size: 1024,
  shrinking: { unsupported: ["Resizing is not supported"] },
  systems: [],
  partitionTable: {
    type: "gpt",
    partitions: [sda1],
    unpartitionedSize: 0,
    unusedSlots: [{ start: 3, size: gib(2) }],
  },
  udevIds: ["ata-Micron_1100_SATA_512GB_12563", "scsi-0ATA_Micron_1100_SATA_512GB"],
  udevPaths: ["pci-0000:00-12", "pci-0000:00-12-ata"],
  description: "",
};

const sdb: StorageDevice = {
  sid: 60,
  isDrive: true,
  type: "disk",
  name: "/dev/sdb",
  size: 1024,
  systems: [],
  description: "",
};

const mockSdaDrive: model.Drive = {
  name: "/dev/sda",
  spacePolicy: "delete",
  partitions: [
    {
      mountPath: "swap",
      size: {
        min: gib(2),
        default: false, // false: user provided, true: calculated
      },
      filesystem: { default: false, type: "swap" },
      isNew: true,
      isUsed: false,
      isReused: false,
      isUsedBySpacePolicy: false,
    },
    {
      mountPath: "/home",
      size: {
        min: gib(16),
        default: true,
      },
      filesystem: { default: false, type: "xfs" },
      isNew: true,
      isUsed: false,
      isReused: false,
      isUsedBySpacePolicy: false,
    },
  ],
  list: "drives",
  listIndex: 1,
  isExplicitBoot: false,
  isUsed: true,
  isAddingPartitions: true,
  isReusingPartitions: true,
  isTargetDevice: true,
  isBoot: false,
  getMountPaths: () => ["/home", "swap"],
  getVolumeGroups: () => [],
  getPartition: jest.fn(),
  getConfiguredExistingPartitions: jest.fn(),
};

const mockRootVolumeGroup: model.VolumeGroup = {
  vgName: "fakeRootVg",
  list: "volumeGroups",
  listIndex: 1,
  logicalVolumes: [],
  getTargetDevices: () => [mockSdaDrive],
  getMountPaths: () => [],
};

const mockHomeVolumeGroup: model.VolumeGroup = {
  vgName: "fakeHomeVg",
  list: "volumeGroups",
  listIndex: 2,
  logicalVolumes: [],
  getTargetDevices: () => [mockSdaDrive],
  getMountPaths: () => [],
};

const mockAddVolumeGroup = jest.fn();
const mockEditVolumeGroup = jest.fn();

let mockUseModel = {
  drives: [mockSdaDrive],
  mdRaids: [],
  volumeGroups: [],
};

const mockUseAllDevices = [sda, sdb];

jest.mock("~/queries/issues", () => ({
  ...jest.requireActual("~/queries/issues"),
  useIssuesChanges: jest.fn(),
  useIssues: () => [],
}));

jest.mock("~/queries/storage", () => ({
  ...jest.requireActual("~/queries/storage"),
  useDevices: () => mockUseAllDevices,
}));

jest.mock("~/hooks/storage/system", () => ({
  ...jest.requireActual("~/hooks/storage/system"),
  useAvailableDevices: () => mockUseAllDevices,
}));

jest.mock("~/hooks/storage/model", () => ({
  ...jest.requireActual("~/hooks/storage/model"),
  __esModule: true,
  useModel: () => mockUseModel,
}));

jest.mock("~/hooks/storage/volume-group", () => ({
  ...jest.requireActual("~/hooks/storage/volume-group"),
  __esModule: true,
  useAddVolumeGroup: () => mockAddVolumeGroup,
  useEditVolumeGroup: () => mockEditVolumeGroup,
}));

describe("LvmPage", () => {
  describe("when creating a new volume group", () => {
    it("allows configuring a new LVM volume group (without moving mount points)", async () => {
      const { user } = installerRender(<LvmPage />);
      const name = screen.getByRole("textbox", { name: "Name" });
      const disks = screen.getByRole("group", { name: "Disks" });
      const sdaCheckbox = within(disks).getByRole("checkbox", { name: "sda (1 KiB)" });
      const sdbCheckbox = within(disks).getByRole("checkbox", { name: "sdb (1 KiB)" });
      const moveMountPointsCheckbox = screen.getByRole("checkbox", {
        name: /Move the mount points currently configured at the selected disks to logical volumes/,
      });
      const acceptButton = screen.getByRole("button", { name: "Accept" });

      // Clear default value for name
      await user.clear(name);
      await user.type(name, "root-vg");
      await user.click(sdbCheckbox);

      // sda is selected by default because it is adding partitions.
      expect(sdaCheckbox).toBeChecked();
      // By default move mount points should be checked
      expect(moveMountPointsCheckbox).toBeChecked();
      await user.click(moveMountPointsCheckbox);
      expect(moveMountPointsCheckbox).not.toBeChecked();
      await user.click(acceptButton);
      expect(mockAddVolumeGroup).toHaveBeenCalledWith(
        { vgName: "root-vg", targetDevices: ["/dev/sda", "/dev/sdb"] },
        false,
      );
    });

    it("allows configuring a new LVM volume group (moving mount points)", async () => {
      const { user } = installerRender(<LvmPage />);
      const disks = screen.getByRole("group", { name: "Disks" });
      const sdbCheckbox = within(disks).getByRole("checkbox", { name: "sdb (1 KiB)" });
      const moveMountPointsCheckbox = screen.getByRole("checkbox", {
        name: /Move the mount points currently configured at the selected disks to logical volumes/,
      });
      const acceptButton = screen.getByRole("button", { name: "Accept" });

      await user.click(sdbCheckbox);
      expect(moveMountPointsCheckbox).toBeChecked();
      await user.click(acceptButton);
      expect(mockAddVolumeGroup).toHaveBeenCalledWith(
        { vgName: "system", targetDevices: ["/dev/sda", "/dev/sdb"] },
        true,
      );
    });

    it("performs basic validations", async () => {
      const { user } = installerRender(<LvmPage />);
      const name = screen.getByRole("textbox", { name: "Name" });
      const disks = screen.getByRole("group", { name: "Disks" });
      const sdaCheckbox = within(disks).getByRole("checkbox", { name: "sda (1 KiB)" });
      const acceptButton = screen.getByRole("button", { name: "Accept" });

      // Unselect sda
      await user.click(sdaCheckbox);

      // Let's clean the default given name
      await user.clear(name);
      await user.click(acceptButton);
      screen.getByText("Warning alert:");
      screen.getByText(/Enter a name/);
      screen.getByText(/Select at least one disk/);

      // Type a name
      await user.type(name, "root-vg");
      await user.click(acceptButton);
      screen.getByText("Warning alert:");
      expect(screen.queryByText(/Enter a name/)).toBeNull();
      screen.getByText(/Select at least one disk/);

      // Select sda again
      expect(sdaCheckbox).not.toBeChecked();
      await user.click(sdaCheckbox);
      expect(sdaCheckbox).toBeChecked();
      await user.click(acceptButton);
      expect(screen.queryByText("Warning alert:")).toBeNull();
      expect(screen.queryByText(/Enter a name/)).toBeNull();
      expect(screen.queryByText(/Select at least one disk/)).toBeNull();
    });

    describe("when there are LVM volume groups", () => {
      beforeEach(() => {
        mockUseModel = {
          drives: [mockSdaDrive],
          mdRaids: [],
          volumeGroups: [mockRootVolumeGroup],
        };
      });

      it("does not pre-fill the name input", () => {
        installerRender(<LvmPage />);
        const name = screen.getByRole("textbox", { name: "Name" });
        expect(name).toHaveValue("");
      });
    });

    describe("when there are no LVM volume groups yet", () => {
      beforeEach(() => {
        mockUseModel = {
          drives: [mockSdaDrive],
          mdRaids: [],
          volumeGroups: [],
        };
      });

      it("pre-fills the name input with 'system'", () => {
        installerRender(<LvmPage />);
        const name = screen.getByRole("textbox", { name: "Name" });
        expect(name).toHaveValue("system");
      });
    });
  });

  describe("when editing", () => {
    beforeEach(() => {
      mockParams({ id: "fakeRootVg" });
      mockUseModel = {
        drives: [mockSdaDrive],
        mdRaids: [],
        volumeGroups: [mockRootVolumeGroup, mockHomeVolumeGroup],
      };
    });

    it("performs basic validations", async () => {
      const { user } = installerRender(<LvmPage />);
      const name = screen.getByRole("textbox", { name: "Name" });
      const disks = screen.getByRole("group", { name: "Disks" });
      const sdaCheckbox = within(disks).getByRole("checkbox", { name: "sda (1 KiB)" });
      const acceptButton = screen.getByRole("button", { name: "Accept" });

      // Let's clean the default given name
      await user.clear(name);
      await user.click(sdaCheckbox);
      expect(name).toHaveValue("");
      expect(sdaCheckbox).not.toBeChecked();
      await user.click(acceptButton);
      screen.getByText("Warning alert:");
      screen.getByText(/Enter a name/);
      screen.getByText(/Select at least one disk/);
      // Enter a name already in use
      await user.type(name, "fakeHomeVg");
      await user.click(acceptButton);
      expect(screen.queryByText(/Enter a name/)).toBeNull();
      screen.getByText(/Enter a different name/);
    });

    it("pre-fills form with the current volume group configuration", async () => {
      installerRender(<LvmPage />);
      const name = screen.getByRole("textbox", { name: "Name" });
      const sdaCheckbox = screen.getByRole("checkbox", { name: "sda (1 KiB)" });
      expect(name).toHaveValue("fakeRootVg");
      expect(sdaCheckbox).toBeChecked();
    });

    it("does not offer option for moving mount points", () => {
      installerRender(<LvmPage />);
      expect(
        screen.queryByRole("checkbox", {
          name: /Move the mount points currently configured at the selected disks to logical volumes/,
        }),
      ).toBeNull();
    });

    it("triggers the hook for updating the volume group when user accepts changes", async () => {
      const { user } = installerRender(<LvmPage />);
      const name = screen.getByRole("textbox", { name: "Name" });
      const acceptButton = screen.getByRole("button", { name: "Accept" });
      await user.clear(name);
      await user.type(name, "updatedRootVg");
      await user.click(acceptButton);
      expect(mockEditVolumeGroup).toHaveBeenCalledWith("fakeRootVg", {
        vgName: "updatedRootVg",
        targetDevices: ["/dev/sda"],
      });
    });
  });
});
