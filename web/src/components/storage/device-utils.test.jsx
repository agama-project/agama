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

// @ts-check

import React from "react";
import { screen } from "@testing-library/react";
import { plainRender } from "~/test-utils";
import {
  DeviceDetails,
  DeviceName,
  DeviceSize,
  FilesystemLabel,
  toStorageDevice,
} from "~/components/storage/device-utils";

/**
 * @typedef {import("~/client/storage").PartitionSlot} PartitionSlot
 * @typedef {import("~/client/storage").StorageDevice} StorageDevice
 */

/** @type {PartitionSlot} */
const slot = { start: 1234, size: 256 };

/** @type {StorageDevice} */
const vda = {
  sid: 59,
  isDrive: true,
  type: "disk",
  vendor: "Micron",
  model: "Micron 1100 SATA",
  driver: ["ahci", "mmcblk"],
  bus: "IDE",
  transport: "usb",
  dellBOSS: false,
  sdCard: true,
  active: true,
  name: "/dev/vda",
  description: "",
  size: 1024,
  systems: ["Windows 11", "openSUSE Leap 15.2"],
  udevIds: ["ata-Micron_1100_SATA_512GB_12563", "scsi-0ATA_Micron_1100_SATA_512GB"],
  udevPaths: ["pci-0000:00-12", "pci-0000:00-12-ata"],
};

/** @type {StorageDevice} */
const vda1 = {
  sid: 60,
  isDrive: false,
  type: "partition",
  active: true,
  name: "/dev/vda1",
  description: "",
  size: 512,
  start: 123,
  encrypted: false,
  shrinking: { supported: 128 },
  systems: [],
  udevIds: [],
  udevPaths: [],
  isEFI: false,
  filesystem: { sid: 100, type: "ext4", mountPath: "/test", label: "system" },
};

/** @type {StorageDevice}  */
const lvmLv1 = {
  sid: 73,
  isDrive: false,
  type: "lvmLv",
  active: true,
  name: "/dev/vg0/lv1",
  description: "",
  size: 512,
  start: 0,
  encrypted: false,
  shrinking: { unsupported: ["Resizing is not supported"] },
  systems: [],
  udevIds: [],
  udevPaths: [],
};

describe("FilesystemLabel", () => {
  it("renders the label of the file system", () => {
    plainRender(<FilesystemLabel item={vda1} />);
    screen.getByText("system");
  });
});

describe("DeviceName", () => {
  it("renders the base name if the device is a partition", () => {
    plainRender(<DeviceName item={vda1} />);
    screen.getByText(/^vda1/);
  });

  it("renders the base name if the device is a logical volume", () => {
    plainRender(<DeviceName item={lvmLv1} />);
    screen.getByText(/^lv1/);
  });

  it("renders the full name for other devices", () => {
    plainRender(<DeviceName item={vda} />);
    screen.getByText(/\/dev\/vda/);
  });
});

describe("DeviceDetails", () => {
  /** @type {PartitionSlot|StorageDevice} */
  let item;

  describe("if the item is a partition slot", () => {
    beforeEach(() => {
      item = slot;
    });

    it("renders 'Unused space'", () => {
      plainRender(<DeviceDetails item={item} />);
      screen.getByText("Unused space");
    });
  });

  describe("if the item is a storage device", () => {
    beforeEach(() => {
      item = { ...vda };
    });

    describe("and it has a file system", () => {
      beforeEach(() => {
        item = toStorageDevice(item);
        item.filesystem = { sid: 100, type: "ext4", mountPath: "/test", label: "data" };
      });

      it("renders the file system label", () => {
        plainRender(<DeviceDetails item={item} />);
        screen.getByText("data");
      });
    });

    describe("and it has a partition table", () => {
      beforeEach(() => {
        item = toStorageDevice(item);
        item.partitionTable = {
          type: "gpt",
          partitions: [],
          unpartitionedSize: 0,
          unusedSlots: [],
        };
      });

      it("renders the partition table type", () => {
        plainRender(<DeviceDetails item={item} />);
        screen.getByText("GPT");
      });
    });

    describe("and it has no partition table", () => {
      beforeEach(() => {
        item = toStorageDevice(item);
        item.partitionTable = undefined;
        item.description = "Ext4 disk";
      });

      describe("and it has systems", () => {
        beforeEach(() => {
          item = toStorageDevice(item);
          item.systems = ["Tumbleweed", "Leap"];
        });

        it("renders the systems", () => {
          plainRender(<DeviceDetails item={item} />);
          screen.getByText(/Tumbleweed/);
          screen.getByText(/Leap/);
        });
      });

      describe("and it has no systems", () => {
        beforeEach(() => {
          item = toStorageDevice(item);
          item.systems = [];
        });

        it("renders the description", () => {
          plainRender(<DeviceDetails item={item} />);
          screen.getByText("Ext4 disk");
        });
      });
    });
  });
});

describe("DeviceSize", () => {
  it("renders the device size", () => {
    plainRender(<DeviceSize item={vda} />);
    screen.getByText("1 KiB");
  });
});
