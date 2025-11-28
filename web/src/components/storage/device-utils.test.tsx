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
import {
  DeviceDetails,
  DeviceName,
  DeviceSize,
  FilesystemLabel,
  toDevice,
} from "~/components/storage/device-utils";
import { UnusedSlot } from "~/model/system/storage";
import type { storage } from "~/model/system";

const vda: storage.Device = {
  sid: 59,
  class: "drive",
  name: "/dev/vda",
  drive: {
    vendor: "Micron",
    model: "Micron 1100 SATA",
    driver: ["ahci", "mmcblk"],
    bus: "IDE",
    transport: "usb",
    info: {
      dellBoss: false,
      sdCard: true,
    },
  },
  block: {
    active: true,
    start: 10,
    size: 1024,
    shrinking: { supported: false },
    // systems: ["Windows 11", "openSUSE Leap 15.2"],
    udevIds: ["ata-Micron_1100_SATA_512GB_12563", "scsi-0ATA_Micron_1100_SATA_512GB"],
    udevPaths: ["pci-0000:00-12", "pci-0000:00-12-ata"],
  },
  partitions: [
    {
      sid: 60,
      class: "partition",
      name: "/dev/vda1",
      block: {
        active: true,
        start: 123,
        size: 512,
        shrinking: { supported: true },
        encrypted: false,
      },
      partition: { efi: false },
      filesystem: {
        sid: 100,
        type: "ext4",
        mountPath: "/test",
        label: "system",
      },
    },
  ],
};

const lv: storage.Device = {
  sid: 73,
  class: "logicalVolume",
  name: "/dev/vg0/lv1",
  block: {
    active: true,
    size: 512,
    start: 0,
    encrypted: false,
    shrinking: {
      supported: false,
      reasons: ["Resizing is not supported"],
    },
  },
};

describe("FilesystemLabel", () => {
  it("renders the label of the file system", () => {
    plainRender(<FilesystemLabel item={vda.partitions[0]} />);
    screen.getByText("system");
  });
});

describe("DeviceName", () => {
  it("renders the base name if the device is a partition", () => {
    plainRender(<DeviceName item={vda.partitions[0]} />);
    screen.getByText(/^vda1/);
  });

  it("renders the base name if the device is a logical volume", () => {
    plainRender(<DeviceName item={lv} />);
    screen.getByText(/^lv1/);
  });

  it("renders the full name for other devices", () => {
    plainRender(<DeviceName item={vda} />);
    screen.getByText(/\/dev\/vda/);
  });
});

describe("DeviceDetails", () => {
  let item: UnusedSlot | storage.Device;

  describe("if the item is a partition slot", () => {
    beforeEach(() => {
      item = { start: 1234, size: 256 };
    });

    it("renders 'Unused space'", () => {
      plainRender(<DeviceDetails item={item} />);
      screen.getByText("Unused space");
    });
  });

  describe("if the item is a storage device", () => {
    beforeEach(() => {
      item = vda;
    });

    describe("and it has a file system", () => {
      beforeEach(() => {
        item = {
          ...toDevice(item),
          filesystem: {
            sid: 100,
            type: "ext4",
            mountPath: "/test",
            label: "data",
          },
        };
      });

      it("renders the file system label", () => {
        plainRender(<DeviceDetails item={item} />);
        screen.getByText("data");
      });
    });

    describe("and it has a partition table", () => {
      beforeEach(() => {
        item = {
          ...toDevice(item),
          partitionTable: {
            type: "gpt",
            unusedSlots: [],
          },
          partitions: [],
        };
      });

      it("renders the partition table type", () => {
        plainRender(<DeviceDetails item={item} />);
        screen.getByText("GPT");
      });
    });

    describe("and it has no partition table", () => {
      beforeEach(() => {
        item = { ...toDevice(item), description: "Ext4 disk" };
      });

      describe("and it has systems", () => {
        beforeEach(() => {
          item = toDevice(item);
          item.block.systems = ["Tumbleweed", "Leap"];
        });

        it("renders the systems", () => {
          plainRender(<DeviceDetails item={item} />);
          screen.getByText(/Tumbleweed/);
          screen.getByText(/Leap/);
        });
      });

      describe("and it has no systems", () => {
        beforeEach(() => {
          item = toDevice(item);
          item.block.systems = [];
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
