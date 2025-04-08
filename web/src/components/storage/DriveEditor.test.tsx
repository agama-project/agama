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
import { plainRender, mockNavigateFn } from "~/test-utils";
import DriveEditor from "~/components/storage/DriveEditor";
import { StorageDevice } from "~/types/storage";
import { apiModel, Volume } from "~/api/storage/types";

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

const drive1: apiModel.Drive = {
  name: "/dev/sda",
  spacePolicy: "delete",
  partitions: [
    {
      mountPath: "/",
      size: {
        min: 1_000_000_000,
        default: true,
      },
      filesystem: { default: true, type: "btrfs" },
    },
    {
      mountPath: "swap",
      size: {
        min: 2_000_000_000,
        default: false, // false: user provided, true: calculated
      },
      filesystem: { default: false, type: "swap" },
    },
  ],
};

const drive2: apiModel.Drive = {
  name: "/dev/sdb",
  spacePolicy: "delete",
  partitions: [
    {
      mountPath: "/home",
      size: {
        min: 1_000_000_000,
        default: true,
      },
      filesystem: { default: true, type: "xfs" },
    },
  ],
};

const mockDeleteDrive = jest.fn();
const mockDeletePartition = jest.fn();

let additionalDrives = true;

jest.mock("~/queries/storage", () => ({
  ...jest.requireActual("~/queries/storage"),
  useAvailableDevices: () => [sda],
  useVolume: (mountPath: string): Volume =>
    [volume1, volume2, volume3].find((v) => v.mountPath === mountPath),
}));

jest.mock("~/queries/storage/config-model", () => ({
  ...jest.requireActual("~/queries/storage/config-model"),
  useConfigModel: () => ({ drives: [drive1, drive2] }),
  useDrive: (name) => ({
    isExplicitBoot: name === "/dev/sda",
    delete: mockDeleteDrive,
    getPartition: (path) => drive1.partitions.find((p) => p.mountPath === path),
    deletePartition: mockDeletePartition,
  }),
  useModel: () => ({
    hasAdditionalDrives: additionalDrives,
  }),
}));

describe("PartitionMenuItem", () => {
  it("allows users to delete a not required partition", async () => {
    const { user } = plainRender(<DriveEditor drive={drive1} driveDevice={sda} />);

    const partitionsButton = screen.getByRole("button", { name: "Partitions" });
    await user.click(partitionsButton);
    const partitionsMenu = screen.getByRole("menu");
    const deleteSwapButton = within(partitionsMenu).getByRole("menuitem", {
      name: "Delete swap",
    });
    await user.click(deleteSwapButton);
    expect(mockDeletePartition).toHaveBeenCalled();
  });

  it("allows users to delete a required partition", async () => {
    const { user } = plainRender(<DriveEditor drive={drive1} driveDevice={sda} />);

    const partitionsButton = screen.getByRole("button", { name: "Partitions" });
    await user.click(partitionsButton);
    const partitionsMenu = screen.getByRole("menu");
    const deleteRootButton = within(partitionsMenu).getByRole("menuitem", {
      name: "Delete /",
    });
    await user.click(deleteRootButton);
    expect(mockDeletePartition).toHaveBeenCalled();
  });

  it("allows users to edit a partition", async () => {
    const { user } = plainRender(<DriveEditor drive={drive1} driveDevice={sda} />);

    const partitionsButton = screen.getByRole("button", { name: "Partitions" });
    await user.click(partitionsButton);
    const partitionsMenu = screen.getByRole("menu");
    const editSwapButton = within(partitionsMenu).getByRole("menuitem", {
      name: "Edit swap",
    });
    await user.click(editSwapButton);
    expect(mockNavigateFn).toHaveBeenCalledWith("/storage/drives/sda/partitions/swap/edit");
  });
});

describe("RemoveDriveOption", () => {
  describe("if there are additional drives", () => {
    beforeEach(() => {
      additionalDrives = true;
    });

    it("allows users to delete regular drives", async () => {
      const { user } = plainRender(<DriveEditor drive={drive2} driveDevice={sdb} />);

      const driveButton = screen.getByRole("button", { name: "Drive" });
      await user.click(driveButton);
      const drivesMenu = screen.getByRole("menu");
      const deleteDriveButton = within(drivesMenu).getByRole("menuitem", {
        name: /Do not use/,
      });
      await user.click(deleteDriveButton);
      expect(mockDeleteDrive).toHaveBeenCalled();
    });

    it("does not allow users to delete drives explicitly used to boot", async () => {
      const { user } = plainRender(<DriveEditor drive={drive1} driveDevice={sda} />);

      const driveButton = screen.getByRole("button", { name: "Drive" });
      await user.click(driveButton);
      const drivesMenu = screen.getByRole("menu");
      const deleteDriveButton = within(drivesMenu).queryByRole("menuitem", {
        name: /Do not use/,
      });
      expect(deleteDriveButton).not.toBeInTheDocument();
    });
  });

  describe("if there are no additional drives", () => {
    beforeEach(() => {
      additionalDrives = false;
    });

    it("does not allow users to delete regular drives", async () => {
      const { user } = plainRender(<DriveEditor drive={drive2} driveDevice={sdb} />);

      const driveButton = screen.getByRole("button", { name: "Drive" });
      await user.click(driveButton);
      const drivesMenu = screen.getByRole("menu");
      const deleteDriveButton = within(drivesMenu).queryByRole("menuitem", {
        name: /Do not use/,
      });
      expect(deleteDriveButton).not.toBeInTheDocument();
    });

    it("does not allow users to delete drives explicitly used to boot", async () => {
      const { user } = plainRender(<DriveEditor drive={drive1} driveDevice={sda} />);

      const driveButton = screen.getByRole("button", { name: "Drive" });
      await user.click(driveButton);
      const drivesMenu = screen.getByRole("menu");
      const deleteDriveButton = within(drivesMenu).queryByRole("menuitem", {
        name: /Do not use/,
      });
      expect(deleteDriveButton).not.toBeInTheDocument();
    });
  });
});
