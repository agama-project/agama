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
import DriveEditor from "~/components/storage/DriveEditor";
import { StorageDevice, model } from "~/types/storage";
import { Volume } from "~/api/storage/types";

const mockDeleteDrive = jest.fn();
const mockSwitchToDrive = jest.fn();
const mockUseModel = jest.fn();

const volume1: Volume = {
  mountPath: "/",
  mountOptions: [],
  target: "default",
  fsType: "Btrfs",
  minSize: 1024,
  maxSize: 1024,
  autoSize: false,
  snapshots: false,
  transactional: false,
  outline: {
    required: true,
    fsTypes: ["Btrfs"],
    supportAutoSize: false,
    snapshotsConfigurable: false,
    snapshotsAffectSizes: false,
    sizeRelevantVolumes: [],
    adjustByRam: false,
  },
};

const volume2: Volume = {
  mountPath: "swap",
  mountOptions: [],
  target: "default",
  fsType: "Swap",
  minSize: 1024,
  maxSize: 1024,
  autoSize: false,
  snapshots: false,
  transactional: false,
  outline: {
    required: false,
    fsTypes: ["Swap"],
    supportAutoSize: false,
    snapshotsConfigurable: false,
    snapshotsAffectSizes: false,
    sizeRelevantVolumes: [],
    adjustByRam: false,
  },
};

const volume3: Volume = {
  mountPath: "/home",
  mountOptions: [],
  target: "default",
  fsType: "XFS",
  minSize: 1024,
  maxSize: 1024,
  autoSize: false,
  snapshots: false,
  transactional: false,
  outline: {
    required: false,
    fsTypes: ["XFS"],
    supportAutoSize: false,
    snapshotsConfigurable: false,
    snapshotsAffectSizes: false,
    sizeRelevantVolumes: [],
    adjustByRam: false,
  },
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
  description: "",
};

const drive1Partitions: model.Partition[] = [
  {
    mountPath: "/",
    size: {
      min: 1_000_000_000,
      default: true,
    },
    filesystem: { default: true, type: "btrfs" },
    isNew: true,
    isUsed: false,
    isReused: false,
    isUsedBySpacePolicy: false,
  },
  {
    mountPath: "swap",
    size: {
      min: 2_000_000_000,
      default: false, // false: user provided, true: calculated
    },
    filesystem: { default: false, type: "swap" },
    isNew: true,
    isUsed: false,
    isReused: false,
    isUsedBySpacePolicy: false,
  },
];

const drive1 = {
  name: "/dev/sda",
  spacePolicy: "delete",
  partitions: drive1Partitions,
  list: "drives",
  listIndex: 1,
  isUsed: true,
  isAddingPartitions: true,
  isTargetDevice: false,
  isBoot: true,
  isExplicitBoot: true,
  getVolumeGroups: () => [],
  getPartition: jest.fn(),
  getMountPaths: () => drive1Partitions.map((p) => p.mountPath),
  getConfiguredExistingPartitions: jest.fn(),
};

const drive2Partitions: model.Partition[] = [
  {
    mountPath: "/home",
    size: {
      min: 1_000_000_000,
      default: true,
    },
    filesystem: { default: true, type: "xfs" },
    isNew: true,
    isUsed: false,
    isReused: false,
    isUsedBySpacePolicy: false,
  },
];

const drive2 = {
  name: "/dev/sdb",
  spacePolicy: "delete",
  partitions: drive2Partitions,
  list: "drives",
  listIndex: 2,
  isExplicitBoot: false,
  isUsed: true,
  isAddingPartitions: true,
  isTargetDevice: false,
  isBoot: true,
  getVolumeGroups: () => [],
  getPartition: jest.fn(),
  getMountPaths: () => drive2Partitions.map((p) => p.mountPath),
  getConfiguredExistingPartitions: jest.fn(),
};

jest.mock("~/queries/storage", () => ({
  ...jest.requireActual("~/queries/storage"),
  useVolume: (mountPath: string): Volume =>
    [volume1, volume2, volume3].find((v) => v.mountPath === mountPath),
}));

jest.mock("~/hooks/storage/system", () => ({
  ...jest.requireActual("~/hooks/storage/system"),
  useAvailableDevices: () => [sda, sdb],
  useCandidateDevices: () => [sda],
}));

jest.mock("~/hooks/storage/drive", () => ({
  ...jest.requireActual("~/hooks/storage/drive"),
  __esModule: true,
  useDeleteDrive: () => mockDeleteDrive,
  useSwitchToDrive: () => mockSwitchToDrive,
}));

jest.mock("~/hooks/storage/model", () => ({
  ...jest.requireActual("~/hooks/storage/model"),
  useModel: () => mockUseModel(),
}));

describe("RemoveDriveOption", () => {
  describe("if there are additional drives", () => {
    beforeEach(() => {
      mockUseModel.mockReturnValue({ drives: [drive1, drive2], mdRaids: [] });
    });

    it("allows users to delete regular drives", async () => {
      // @ts-expect-error: drives are not typed on purpose because
      // isReusingPartitions should be a calculated data. Mocking needs a lot of
      // improvements.
      const { user } = plainRender(<DriveEditor drive={drive2} driveDevice={sdb} />);

      const changeButton = screen.getByRole("button", { name: /Use disk sdb/ });
      await user.click(changeButton);
      const drivesMenu = screen.getByRole("menu", { name: "Device /dev/sdb menu" });
      const deleteDriveButton = within(drivesMenu).getByRole("menuitem", {
        name: /Do not use/,
      });
      await user.click(deleteDriveButton);
      expect(mockDeleteDrive).toHaveBeenCalled();
    });

    it("does not allow users to delete drives explicitly used to boot", async () => {
      // @ts-expect-error: drives are not typed on purpose because
      // isReusingPartitions should be a calculated data. Mocking needs a lot of
      // improvements.
      const { user } = plainRender(<DriveEditor drive={drive1} driveDevice={sda} />);

      const changeButton = screen.getByRole("button", { name: /Use disk sda/ });
      await user.click(changeButton);
      const drivesMenu = screen.getByRole("menu", { name: "Device /dev/sda menu" });
      const deleteDriveButton = within(drivesMenu).queryByRole("menuitem", {
        name: /Do not use/,
      });
      expect(deleteDriveButton).toBeDisabled();
    });
  });

  describe("if there are no additional drives", () => {
    it("does not allow users to delete regular drives", async () => {
      mockUseModel.mockReturnValue({ drives: [drive2], mdRaids: [] });
      // @ts-expect-error: drives are not typed on purpose because
      // isReusingPartitions should be a calculated data. Mocking needs a lot of
      // improvements.
      const { user } = plainRender(<DriveEditor drive={drive2} driveDevice={sdb} />);

      const changeButton = screen.getByRole("button", { name: /Use disk sdb/ });
      await user.click(changeButton);
      const drivesMenu = screen.getByRole("menu", { name: "Device /dev/sdb menu" });
      const deleteDriveButton = within(drivesMenu).queryByRole("menuitem", {
        name: /Do not use/,
      });
      expect(deleteDriveButton).not.toBeInTheDocument();
    });

    it("does not allow users to delete drives explicitly used to boot", async () => {
      mockUseModel.mockReturnValue({ drives: [drive1], mdRaids: [] });
      // @ts-expect-error: drives are not typed on purpose because
      // isReusingPartitions should be a calculated data. Mocking needs a lot of
      // improvements.
      const { user } = plainRender(<DriveEditor drive={drive1} driveDevice={sda} />);

      const changeButton = screen.getByRole("button", { name: /Use disk sda/ });
      await user.click(changeButton);
      const drivesMenu = screen.getByRole("menu", { name: "Device /dev/sda menu" });
      const deleteDriveButton = within(drivesMenu).queryByRole("menuitem", {
        name: /Do not use/,
      });
      expect(deleteDriveButton).not.toBeInTheDocument();
    });
  });
});
