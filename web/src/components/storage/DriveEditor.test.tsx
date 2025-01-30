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
import DriveEditor, { DriveEditorProps } from "~/components/storage/DriveEditor";
import * as ConfigModel from "~/api/storage/types/config-model";
import { StorageDevice } from "~/types/storage";

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

const mockDrive: ConfigModel.Drive = {
  name: "/dev/sda",
  spacePolicy: "delete",
  partitions: [
    {
      mountPath: "swap",
      size: {
        min: 2_000_000_000,
        default: false, // false: user provided, true: calculated
      },
    },
  ],
};

const mockDeleteDrive = jest.fn();
const mockDeletePartition = jest.fn();

jest.mock("~/queries/storage", () => ({
  ...jest.requireActual("~/queries/storage"),
  useAvailableDevices: () => [sda],
}));

jest.mock("~/queries/storage/config-model", () => ({
  ...jest.requireActual("~/queries/storage/config-model"),
  useConfigModel: () => ({ drives: [mockDrive] }),
  useDrive: () => ({ delete: mockDeleteDrive }),
  usePartition: () => ({ delete: mockDeletePartition }),
}));

const props: DriveEditorProps = {
  drive: mockDrive,
  driveDevice: sda,
};

describe("PartitionMenuItem", () => {
  it("allows users to delete the partition", async () => {
    const { user } = plainRender(<DriveEditor {...props} />);

    const partitionsButton = screen.getByRole("button", { name: "Partitions" });
    await user.click(partitionsButton);
    const partitionsMenu = screen.getByRole("menu");
    const deleteSwapButton = within(partitionsMenu).getByRole("menuitem", {
      name: "Delete swap",
    });
    await user.click(deleteSwapButton);
    expect(mockDeletePartition).toHaveBeenCalled();
  });
});

describe("RemoveDriveOption", () => {
  it("allows users to delete the drive", async () => {
    const { user } = plainRender(<DriveEditor {...props} />);

    const driveButton = screen.getByRole("button", { name: "Drive" });
    await user.click(driveButton);
    const drivesMenu = screen.getByRole("menu");
    const deleteDriveButton = within(drivesMenu).getByRole("menuitem", {
      name: /Do not use/,
    });
    await user.click(deleteDriveButton);
    expect(mockDeleteDrive).toHaveBeenCalled();
  });
});
