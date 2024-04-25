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
// cspell:ignore dasda ddgdcbibhd

import React from "react";
import { screen } from "@testing-library/react";
import { plainRender } from "~/test-utils";
import { DeviceContentInfo, DeviceExtendedInfo } from "~/components/storage/device-utils";

/**
 * @typedef {import("~/client/storage").StorageDevice} StorageDevice
 */

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
  systems : ["Windows 11", "openSUSE Leap 15.2"],
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
  recoverableSize: 128,
  systems : [],
  udevIds: [],
  udevPaths: [],
  isEFI: false
};

/** @type {StorageDevice} */
const vda2 = {
  sid: 61,
  isDrive: false,
  type: "partition",
  active: true,
  name: "/dev/vda2",
  description: "",
  size: 256,
  start: 1789,
  encrypted: false,
  recoverableSize: 0,
  systems : [],
  udevIds: [],
  udevPaths: [],
  isEFI: false
};

vda.partitionTable = {
  type: "gpt",
  partitions: [vda1, vda2],
  unpartitionedSize: 0,
  unusedSlots: []
};

/** @type {StorageDevice} */
const vdb = {
  sid: 62,
  isDrive: true,
  type: "disk",
  vendor: "Disk",
  model: "",
  driver: [],
  bus: "IDE",
  busId: "",
  transport: "",
  dellBOSS: false,
  sdCard: false,
  active: true,
  name: "/dev/vdb",
  description: "",
  size: 2048,
  start: 0,
  encrypted: false,
  recoverableSize: 0,
  systems : [],
  udevIds: [],
  udevPaths: []
};

/** @type {StorageDevice} */
const md0 = {
  sid: 63,
  isDrive: false,
  type: "md",
  level: "raid0",
  uuid: "12345:abcde",
  devices: [vdb],
  active: true,
  name: "/dev/md0",
  description: "",
  size: 2048,
  systems : [],
  udevIds: [],
  udevPaths: []
};

/** @type {StorageDevice} */
const raid = {
  sid: 64,
  isDrive: true,
  type: "raid",
  devices: [vda, vdb],
  vendor: "Dell",
  model: "Dell BOSS-N1 Modular",
  driver: [],
  bus: "",
  busId: "",
  transport: "",
  dellBOSS: true,
  sdCard: false,
  active: true,
  name: "/dev/mapper/isw_ddgdcbibhd_244",
  description: "",
  size: 2048,
  systems : [],
  udevIds: [],
  udevPaths: []
};

/** @type {StorageDevice} */
const multipath = {
  sid: 65,
  isDrive: true,
  type: "multipath",
  wires: [vda, vdb],
  vendor: "",
  model: "",
  driver: [],
  bus: "",
  busId: "",
  transport: "",
  dellBOSS: false,
  sdCard: false,
  active: true,
  name: "/dev/mapper/36005076305ffc73a00000000000013b4",
  description: "",
  size: 2048,
  systems : [],
  udevIds: [],
  udevPaths: []
};

/** @type {StorageDevice} */
const dasd = {
  sid: 66,
  isDrive: true,
  type: "dasd",
  vendor: "IBM",
  model: "IBM",
  driver: [],
  bus: "",
  busId: "0.0.0150",
  transport: "",
  dellBOSS: false,
  sdCard: false,
  active: true,
  name: "/dev/dasda",
  description: "",
  size: 2048,
  systems : [],
  udevIds: [],
  udevPaths: []
};

describe("DeviceExtendedInfo", () => {
  it("renders the device name", () => {
    plainRender(<DeviceExtendedInfo device={vda} />);
    screen.getByText("/dev/vda");
  });

  it("renders the device model", () => {
    plainRender(<DeviceExtendedInfo device={vda} />);
    screen.getByText("Micron 1100 SATA");
  });

  describe("when device is a SDCard", () => {
    it("renders 'SD Card'", () => {
      const sdCard = { ...vda, sdCard: true };
      plainRender(<DeviceExtendedInfo device={sdCard} />);
      screen.getByText("SD Card");
    });
  });

  describe("when device is software RAID", () => {
    it("renders its level", () => {
      plainRender(<DeviceExtendedInfo device={md0} />);
      screen.getByText("Software RAID0");
    });

    it("renders its members", () => {
      plainRender(<DeviceExtendedInfo device={md0} />);
      screen.getByText(/Members/);
      screen.getByText(/vdb/);
    });
  });

  describe("when device is RAID", () => {
    it("renders its devices", () => {
      plainRender(<DeviceExtendedInfo device={raid} />);
      screen.getByText(/Devices/);
      screen.getByText(/vda/);
      screen.getByText(/vdb/);
    });
  });

  describe("when device is a multipath", () => {
    it("renders 'Multipath'", () => {
      plainRender(<DeviceExtendedInfo device={multipath} />);
      screen.getByText("Multipath");
    });

    it("renders its wires", () => {
      plainRender(<DeviceExtendedInfo device={multipath} />);
      screen.getByText(/Wires/);
      screen.getByText(/vda/);
      screen.getByText(/vdb/);
    });
  });

  describe("when device is DASD", () => {
    it("renders its bus id", () => {
      plainRender(<DeviceExtendedInfo device={dasd} />);
      screen.getByText("DASD 0.0.0150");
    });
  });
});

describe("DeviceContentInfo", () => {
  it("renders the partition table info", () => {
    plainRender(<DeviceContentInfo device={vda} />);
    screen.getByText("GPT with 2 partitions");
  });

  it("renders systems info", () => {
    plainRender(<DeviceContentInfo device={vda} />);
    screen.getByText("Windows 11");
    screen.getByText("openSUSE Leap 15.2");
  });
});
