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
import { installerRender } from "~/test-utils";
import * as ConfigModel from "~/api/storage/types/config-model";

import DriveEditor from "~/components/storage/DriveEditor";

// TODO: copied from ExpandableSelector.test.tsx
// TODO: no idea if it fits my purpose
const sda: any = {
  sid: "59",
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
};

const sda1 = {
  sid: "60",
  isDrive: false,
  type: "",
  active: true,
  name: "/dev/sda1",
  size: 512,
  shrinking: { supported: 128 },
  systems: [],
  udevIds: [],
  udevPaths: [],
};

const sda2 = {
  sid: "61",
  isDrive: false,
  type: "",
  active: true,
  name: "/dev/sda2",
  size: 512,
  shrinking: { unsupported: ["Resizing is not supported"] },
  systems: [],
  udevIds: [],
  udevPaths: [],
};

sda.partitionTable = {
  type: "gpt",
  partitions: [sda1, sda2],
  unpartitionedSize: 512,
};

const mockDrive = {
  name: "/dev/sda",
  //spacePolicy: "delete",
  partitions: [
    {
      mountPath: "swap",
      size: {
        min: 2_000_000_000,
        default: false, // WTF does default mean??
      }
    },
  ]
}

const mockConfig = { drives: [mockDrive] as ConfigModel.Drive[] };

// TODO: why does "~/queries/storage" work elsewhere??
jest.mock("~/queries/storage/config-model", () => ({
  ...jest.requireActual("~/queries/storage/config-model"),
  useConfigModel: () => mockConfig,
  useDrive: (name) => mockDrive,
}));


describe("PartitionMenuItem", () => {
  it("does something when the Delete icon is clicked", async () => {
    // oh fun, cannot use DriveEditorProps as it is not exported? any works
    let props: any = {
      // configModel.Drive
      drive: mockDrive,
      // StorageDevice
      driveDevice: sda,
    };
    // if I try to inline it in mockDrive, weird error, string is not SpacePolicy(?)
    props.drive.spacePolicy = "delete";

    //const { user } = installerRender(<DriveEditor {...props} />);
    const { user } = plainRender(<DriveEditor {...props} />);

    // How do I find this? There is no role attribute
    // MenuItemAction actionId="delete-swap" aria-label="Delete swap"
    const button = screen.getByRole("button", { name: /Delete swap/ });
    // Oh, the UI I worked on will only be revealed once we click this:
    //     A new partition will be created for "swap" (at least 1.86 GiB)
    // but how do we identify it?
  });
});
