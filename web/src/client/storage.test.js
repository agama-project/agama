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
// cspell:ignore ECKD dasda ddgdcbibhd wwpns

import { HTTPClient } from "./http";
import DBusClient from "./dbus";
import { StorageClient } from "./storage";

/**
 * @typedef {import("~/client/storage").StorageDevice} StorageDevice
 */

jest.mock("./dbus");

const cockpitProxies = {};

const cockpitCallbacks = {};

let managedObjects = {};

// System devices

/** @type {StorageDevice}  */
const sda = {
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
  description: "",
  size: 1024,
  start: 0,
  encrypted: false,
  recoverableSize: 0,
  systems : [],
  udevIds: ["ata-Micron_1100_SATA_512GB_12563", "scsi-0ATA_Micron_1100_SATA_512GB"],
  udevPaths: ["pci-0000:00-12", "pci-0000:00-12-ata"],
};

/** @type {StorageDevice}  */
const sda1 = {
  sid: 60,
  isDrive: false,
  type: "partition",
  active: true,
  name: "/dev/sda1",
  description: "",
  size: 512,
  start: 123,
  encrypted: false,
  recoverableSize: 128,
  systems : [],
  udevIds: [],
  udevPaths: [],
  isEFI: true
};

/** @type {StorageDevice}  */
const sda2 = {
  sid: 61,
  isDrive: false,
  type: "partition",
  active: true,
  name: "/dev/sda2",
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

/** @type {StorageDevice}  */
const sdb = {
  sid: 62,
  isDrive: true,
  type: "disk",
  vendor: "Samsung",
  model: "Samsung Evo 8 Pro",
  driver: ["ahci"],
  bus: "IDE",
  busId: "",
  transport: "",
  dellBOSS: false,
  sdCard: false,
  active: true,
  name: "/dev/sdb",
  description: "",
  size: 2048,
  start: 0,
  encrypted: false,
  recoverableSize: 0,
  systems : [],
  udevIds: [],
  udevPaths: ["pci-0000:00-19"]
};

/** @type {StorageDevice}  */
const sdc = {
  sid: 63,
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
  name: "/dev/sdc",
  description: "",
  size: 2048,
  start: 0,
  encrypted: false,
  recoverableSize: 0,
  systems : [],
  udevIds: [],
  udevPaths: []
};

/** @type {StorageDevice}  */
const sdd = {
  sid: 64,
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
  name: "/dev/sdd",
  description: "",
  size: 2048,
  start: 0,
  encrypted: false,
  recoverableSize: 0,
  systems : [],
  udevIds: [],
  udevPaths: []
};

/** @type {StorageDevice}  */
const sde = {
  sid: 65,
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
  name: "/dev/sde",
  description: "",
  size: 2048,
  start: 0,
  encrypted: false,
  recoverableSize: 0,
  systems : [],
  udevIds: [],
  udevPaths: []
};

/** @type {StorageDevice}  */
const md0 = {
  sid: 66,
  isDrive: false,
  type: "md",
  level: "raid0",
  uuid: "12345:abcde",
  active: true,
  name: "/dev/md0",
  description: "EXT4 RAID",
  size: 2048,
  start: 0,
  encrypted: false,
  recoverableSize: 0,
  devices: [],
  systems : ["openSUSE Leap 15.2"],
  udevIds: [],
  udevPaths: [],
  filesystem: { sid: 100, type: "ext4", mountPath: "/test", label: "system" }
};

/** @type {StorageDevice}  */
const raid = {
  sid: 67,
  isDrive: true,
  type: "raid",
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
  start: 0,
  encrypted: false,
  recoverableSize: 0,
  devices: [],
  systems : [],
  udevIds: [],
  udevPaths: []
};

/** @type {StorageDevice}  */
const multipath = {
  sid: 68,
  isDrive: true,
  type: "multipath",
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
  start: 0,
  encrypted: false,
  recoverableSize: 0,
  systems : [],
  udevIds: [],
  udevPaths: []
};

/** @type {StorageDevice}  */
const dasd = {
  sid: 69,
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
  start: 0,
  encrypted: false,
  recoverableSize: 0,
  systems : [],
  udevIds: [],
  udevPaths: []
};

/** @type {StorageDevice}  */
const sdf = {
  sid: 70,
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
  name: "/dev/sdf",
  description: "",
  size: 2048,
  start: 0,
  encrypted: false,
  recoverableSize: 0,
  systems : [],
  udevIds: [],
  udevPaths: []
};

/** @type {StorageDevice}  */
const sdf1 = {
  sid: 71,
  isDrive: false,
  type: "partition",
  active: true,
  name: "/dev/sdf1",
  description: "PV of vg0",
  size: 512,
  start: 1024,
  encrypted: true,
  recoverableSize: 0,
  systems : [],
  udevIds: [],
  udevPaths: [],
  isEFI: false
};

/** @type {StorageDevice}  */
const lvmVg = {
  sid: 72,
  isDrive: false,
  type: "lvmVg",
  name: "/dev/vg0",
  description: "LVM",
  size: 512
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
  recoverableSize: 0,
  systems : [],
  udevIds: [],
  udevPaths: []
};

// Define relationship between devices

sda.partitionTable = {
  type: "gpt",
  partitions: [sda1, sda2],
  unpartitionedSize: 256,
  unusedSlots: [{ start: 1234, size: 256 }]
};

sda1.component = {
  type: "md_device",
  deviceNames: ["/dev/md0"]
};

sda2.component = {
  type: "md_device",
  deviceNames: ["/dev/md0"]
};

sdb.component = {
  type: "raid_device",
  deviceNames: ["/dev/mapper/isw_ddgdcbibhd_244"]
};

sdc.component = {
  type: "raid_device",
  deviceNames: ["/dev/mapper/isw_ddgdcbibhd_244"]
};

sdd.component = {
  type: "multipath_wire",
  deviceNames: ["/dev/mapper/36005076305ffc73a00000000000013b4"]
};

sde.component = {
  type: "multipath_wire",
  deviceNames: ["/dev/mapper/36005076305ffc73a00000000000013b4"]
};

sdf.partitionTable = {
  type: "gpt",
  partitions: [sdf1],
  unpartitionedSize: 1536,
  unusedSlots: []
};

sdf1.component = {
  type: "physical_volume",
  deviceNames: ["/dev/vg0"]
};

md0.devices = [sda1, sda2];

raid.devices = [sdb, sdc];

multipath.wires = [sdd, sde];

lvmVg.logicalVolumes = [lvmLv1];
lvmVg.physicalVolumes = [sdf1];

const systemDevices = {
  sda, sda1, sda2, sdb, sdc, sdd, sde, md0, raid, multipath, dasd, sdf, sdf1, lvmVg, lvmLv1
};

// Staging devices
//
// Using a single device because most of the checks are already done with system devices.

/** @type {StorageDevice}  */
const sdbStaging = {
  sid: 62,
  isDrive: true,
  type: "disk",
  vendor: "Samsung",
  model: "Samsung Evo 8 Pro",
  driver: ["ahci"],
  bus: "IDE",
  busId: "",
  transport: "",
  dellBOSS: false,
  sdCard: false,
  active: true,
  name: "/dev/sdb",
  description: "",
  size: 2048,
  start: 0,
  encrypted: false,
  recoverableSize: 0,
  systems : [],
  udevIds: [],
  udevPaths: ["pci-0000:00-19"]
};

const stagingDevices = { sdb: sdbStaging };

const contexts = {
  withProposal: () => {
    return {
      settings: {
        target: "newLvmVg",
        targetPVDevices: ["/dev/sda", "/dev/sdb"],
        configureBoot: true,
        bootDevice: "/dev/sda",
        defaultBootDevice: "/dev/sdb",
        encryptionPassword: "00000",
        encryptionMethod: "luks1",
        spacePolicy: "custom",
        spaceActions: [
          { device: "/dev/sda", action: "force_delete" },
          { device: "/dev/sdb", action: "resize" }
        ],
        volumes: [
          {
            mountPath: "/",
            target: "default",
            targetDevice: "",
            fsType: "Btrfs",
            minSize: 1024,
            maxSize: 2048,
            autoSize: true,
            snapshots: true,
            transactional: true,
            outline: {
              required: true,
              fsTypes: ["Btrfs", "Ext3"],
              supportAutoSize: true,
              snapshotsConfigurable: true,
              snapshotsAffectSizes: true,
              adjustByRam: false,
              sizeRelevantVolumes: ["/home"]
            }
          },
          {
            mountPath: "/home",
            target: "default",
            targetDevice: "",
            fsType: "XFS",
            minSize: 2048,
            maxSize: 4096,
            autoSize: false,
            snapshots: false,
            transactional: false,
            outline: {
              required: false,
              fsTypes: ["Ext4", "XFS"],
              supportAutoSize: false,
              snapshotsConfigurable: false,
              snapshotsAffectSizes: false,
              adjustByRam: false,
              sizeRelevantVolumes: []
            }
          }
        ]
      },
      actions: [{ device: 2, text: "Mount /dev/sdb1 as root", subvol: false, delete: false }]
    };
  },
  withAvailableDevices: () => ["/dev/sda", "/dev/sdb"],
  withIssues: () => [
    { description: "Issue 1", details: "", source: 1, severity: 1 },
    { description: "Issue 2", details: "", source: 1, severity: 0 },
    { description: "Issue 3", details: "", source: 2, severity: 1 }
  ],
  withoutISCSINodes: () => {
    cockpitProxies.iscsiNodes = {};
  },
  withISCSINodes: () => [
    {
      id: 1,
      target: "iqn.2023-01.com.example:37dac",
      address: "192.168.100.101",
      port: 3260,
      interface: "default",
      ibft: false,
      connected: false,
      startup: "",
    },
    {
      id: 2,
      target: "iqn.2023-01.com.example:74afb",
      address: "192.168.100.102",
      port: 3260,
      interface: "default",
      ibft: true,
      connected: true,
      startup: "onboot",
    },
  ],
  withoutDASDDevices: () => {
    cockpitProxies.dasdDevices = {};
  },
  withDASDDevices: () => {
    cockpitProxies.dasdDevices = {
      "/org/opensuse/Agama/Storage1/dasds/8": {
        path: "/org/opensuse/Agama/Storage1/dasds/8",
        AccessType: "",
        DeviceName: "dasd_sample_8",
        Diag: false,
        Enabled: true,
        Formatted: false,
        Id: "0.0.019e",
        PartitionInfo: "",
        Type: "ECKD"
      },
      "/org/opensuse/Agama/Storage1/dasds/9": {
        path: "/org/opensuse/Agama/Storage1/dasds/9",
        AccessType: "rw",
        DeviceName: "dasd_sample_9",
        Diag: false,
        Enabled: true,
        Formatted: false,
        Id: "0.0.ffff",
        PartitionInfo: "/dev/dasd_sample_9",
        Type: "FBA"
      }
    };
  },
  withoutZFCPControllers: () => {
    cockpitProxies.zfcpControllers = {};
  },
  withZFCPControllers: () => {
    cockpitProxies.zfcpControllers = {
      "/org/opensuse/Agama/Storage1/zfcp_controllers/1": {
        path: "/org/opensuse/Agama/Storage1/zfcp_controllers/1",
        Active: false,
        LUNScan: false,
        Channel: "0.0.fa00"
      },
      "/org/opensuse/Agama/Storage1/zfcp_controllers/2": {
        path: "/org/opensuse/Agama/Storage1/zfcp_controllers/2",
        Active: false,
        LUNScan: false,
        Channel: "0.0.fc00"
      }
    };
  },
  withoutZFCPDisks: () => {
    cockpitProxies.zfcpDisks = {};
  },
  withZFCPDisks: () => {
    cockpitProxies.zfcpDisks = {
      "/org/opensuse/Agama/Storage1/zfcp_disks/1": {
        path: "/org/opensuse/Agama/Storage1/zfcp_disks/1",
        Name: "/dev/sda",
        Channel: "0.0.fa00",
        WWPN: "0x500507630703d3b3",
        LUN: "0x0000000000000000"
      },
      "/org/opensuse/Agama/Storage1/zfcp_disks/2": {
        path: "/org/opensuse/Agama/Storage1/zfcp_disks/2",
        Name: "/dev/sdb",
        Channel: "0.0.fa00",
        WWPN: "0x500507630703d3b3",
        LUN: "0x0000000000000001"
      }
    };
  },
  withSystemDevices: () => [
    {
      deviceInfo: {
        sid: 59,
        name: "/dev/sda",
        description: ""
      },
      blockDevice: {
        active: true,
        encrypted: false,
        size: 1024,
        start: 0,
        recoverableSize: 0,
        systems: [],
        udevIds: ["ata-Micron_1100_SATA_512GB_12563", "scsi-0ATA_Micron_1100_SATA_512GB"],
        udevPaths: ["pci-0000:00-12", "pci-0000:00-12-ata"]
      },
      drive: {
        type: "disk",
        vendor: "Micron",
        model: "Micron 1100 SATA",
        driver: ["ahci", "mmcblk"],
        bus: "IDE",
        busId: "",
        transport: "usb",
        info: {
          dellBOSS: false,
          sdCard: true
        }
      },
      partitionTable: {
        type: "gpt",
        partitions: [60, 61],
        unusedSlots: [{ start: 1234, size: 256 }]
      }
    },
    {
      deviceInfo: {
        sid: 60,
        name: "/dev/sda1",
        description: ""
      },
      partition: { efi: true },
      blockDevice: {
        active: true,
        encrypted: false,
        size: 512,
        start: 123,
        recoverableSize: 128,
        systems: [],
        udevIds: [],
        udevPaths: []
      },
      component: {
        type: "md_device",
        deviceNames: ["/dev/md0"],
        devices: [66]
      }
    },
    {
      deviceInfo: {
        sid: 61,
        name: "/dev/sda2",
        description: ""
      },
      partition: { efi: false },
      blockDevice: {
        active: true,
        encrypted: false,
        size: 256,
        start: 1789,
        recoverableSize: 0,
        systems: [],
        udevIds: [],
        udevPaths: []
      },
      component: {
        type: "md_device",
        deviceNames: ["/dev/md0"],
        devices: [66]
      }
    },
    {
      deviceInfo: {
        sid: 62,
        name: "/dev/sdb",
        description: ""
      },
      blockDevice: {
        active: true,
        encrypted: false,
        size: 2048,
        start: 0,
        recoverableSize: 0,
        systems: [],
        udevIds: [],
        udevPaths: ["pci-0000:00-19"]
      },
      drive: {
        type: "disk",
        vendor: "Samsung",
        model: "Samsung Evo 8 Pro",
        driver: ["ahci"],
        bus: "IDE",
        busId: "",
        transport: "",
        info: {
          dellBOSS: false,
          sdCard: false
        }
      },
      component: {
        type: "raid_device",
        deviceNames: ["/dev/mapper/isw_ddgdcbibhd_244"],
        devices: [67]
      }
    },
    {
      deviceInfo: {
        sid: 63,
        name: "/dev/sdc",
        description: ""
      },
      blockDevice: {
        active: true,
        encrypted: false,
        size: 2048,
        start: 0,
        recoverableSize: 0,
        systems: [],
        udevIds: [],
        udevPaths: []
      },
      drive: {
        type: "disk",
        vendor: "Disk",
        model: "",
        driver: [],
        bus: "IDE",
        busId: "",
        transport: "",
        info: {
          dellBOSS: false,
          sdCard: false
        }
      },
      component: {
        type: "raid_device",
        deviceNames: ["/dev/mapper/isw_ddgdcbibhd_244"],
        devices: [67]
      }
    },
    {
      deviceInfo: {
        sid: 64,
        name: "/dev/sdd",
        description: ""
      },
      blockDevice: {
        active: true,
        encrypted: false,
        size: 2048,
        start: 0,
        recoverableSize: 0,
        systems: [],
        udevIds: [],
        udevPaths: []
      },
      drive: {
        type: "disk",
        vendor: "Disk",
        model: "",
        driver: [],
        bus: "IDE",
        busId: "",
        transport: "",
        info: {
          dellBOSS: false,
          sdCard: false
        }
      },
      component: {
        type: "multipath_wire",
        deviceNames: ["/dev/mapper/36005076305ffc73a00000000000013b4"],
        devices: [68]
      }
    },
    {
      deviceInfo: {
        sid: 65,
        name: "/dev/sde",
        description: ""
      },
      blockDevice: {
        active: true,
        encrypted: false,
        size: 2048,
        start: 0,
        recoverableSize: 0,
        systems: [],
        udevIds: [],
        udevPaths: []
      },
      drive: {
        type: "disk",
        vendor: "Disk",
        model: "",
        driver: [],
        bus: "IDE",
        busId: "",
        transport: "",
        info: {
          dellBOSS: false,
          sdCard: false
        }
      },
      component: {
        type: "multipath_wire",
        deviceNames: ["/dev/mapper/36005076305ffc73a00000000000013b4"],
        devices: [68]
      }
    },
    {
      deviceInfo: {
        sid: 66,
        name: "/dev/md0",
        description: "EXT4 RAID"
      },
      blockDevice: {
        active: true,
        encrypted: false,
        size: 2048,
        start: 0,
        recoverableSize: 0,
        systems: ["openSUSE Leap 15.2"],
        udevIds: [],
        udevPaths: []
      },
      md: {
        level: "raid0",
        uuid: "12345:abcde",
        devices: [60, 61]
      },
      filesystem: {
        sid: 100,
        type: "ext4",
        mountPath: "/test",
        label: "system"
      }
    },
    {
      deviceInfo: {
        sid: 67,
        name: "/dev/mapper/isw_ddgdcbibhd_244",
        description: ""
      },
      blockDevice: {
        active: true,
        encrypted: false,
        size: 2048,
        start: 0,
        recoverableSize: 0,
        systems: [],
        udevIds: [],
        udevPaths: []
      },
      drive: {
        type: "raid",
        vendor: "Dell",
        model: "Dell BOSS-N1 Modular",
        driver: [],
        bus: "",
        busId: "",
        transport: "",
        info: {
          dellBOSS: true,
          sdCard: false
        }
      },
      raid: {
        devices: [62, 63]
      }
    },
    {
      deviceInfo: {
        sid: 68,
        name: "/dev/mapper/36005076305ffc73a00000000000013b4",
        description: ""
      },
      blockDevice: {
        active: true,
        encrypted: false,
        size: 2048,
        start: 0,
        recoverableSize: 0,
        systems: [],
        udevIds: [],
        udevPaths: []
      },
      drive: {
        type: "multipath",
        vendor: "",
        model: "",
        driver: [],
        bus: "",
        busId: "",
        transport: "",
        info: {
          dellBOSS: false,
          sdCard: false
        }
      },
      multipath: {
        wires: [64, 65]
      }
    },
    {
      deviceInfo: {
        sid: 69,
        name: "/dev/dasda",
        description: ""
      },
      blockDevice: {
        active: true,
        encrypted: false,
        size: 2048,
        start: 0,
        recoverableSize: 0,
        systems: [],
        udevIds: [],
        udevPaths: []
      },
      drive: {
        type: "dasd",
        vendor: "IBM",
        model: "IBM",
        driver: [],
        bus: "",
        busId: "0.0.0150",
        transport: "",
        info: {
          dellBOSS: false,
          sdCard: false
        }
      }
    },
    {
      deviceInfo: {
        sid: 70,
        name: "/dev/sdf",
        description: ""
      },
      blockDevice: {
        active: true,
        encrypted: false,
        size: 2048,
        start: 0,
        recoverableSize: 0,
        systems: [],
        udevIds: [],
        udevPaths: []
      },
      drive: {
        type: "disk",
        vendor: "Disk",
        model: "",
        driver: [],
        bus: "IDE",
        busId: "",
        transport: "",
        info: {
          dellBOSS: false,
          sdCard: false
        }
      },
      partitionTable: {
        type: "gpt",
        partitions: [71],
        unusedSlots: []
      }
    },
    {
      deviceInfo: {
        sid: 71,
        name: "/dev/sdf1",
        description: "PV of vg0"
      },
      partition: { efi: false },
      blockDevice: {
        active: true,
        encrypted: true,
        size: 512,
        start: 1024,
        recoverableSize: 0,
        systems: [],
        udevIds: [],
        udevPaths: []
      },
      component: {
        type: "physical_volume",
        deviceNames: ["/dev/vg0"],
        devices: [72]
      }
    },
    {
      deviceInfo: {
        sid: 72,
        name: "/dev/vg0",
        description: "LVM"
      },
      lvmVg: {
        type: "physical_volume",
        size: 512,
        physicalVolumes: [71],
        logicalVolumes: [73]
      }
    },
    {
      deviceInfo: {
        sid: 73,
        name: "/dev/vg0/lv1",
        description: ""
      },
      blockDevice: {
        active: true,
        encrypted: false,
        size: 512,
        start: 0,
        recoverableSize: 0,
        systems: [],
        udevIds: [],
        udevPaths: []
      },
      lvmLv: {
        volumeGroup: [72]
      }
    },
  ],
  withStagingDevices: () => [
    {
      deviceInfo: {
        sid: 62,
        name: "/dev/sdb",
        description: ""
      },
      drive: {
        type: "disk",
        vendor: "Samsung",
        model: "Samsung Evo 8 Pro",
        driver: ["ahci"],
        bus: "IDE",
        busId: "",
        transport: "",
        info: {
          dellBOSS: false,
          sdCard: false
        }
      },
      blockDevice: {
        active: true,
        encrypted: false,
        size: 2048,
        start: 0,
        recoverableSize: 0,
        systems: [],
        udevIds: [],
        udevPaths: ["pci-0000:00-19"]
      }
    }
  ]
};

const mockProxy = (iface, path) => {
  switch (iface) {
    case "org.opensuse.Agama.Storage1.ISCSI.Initiator": return cockpitProxies.iscsiInitiator;
    case "org.opensuse.Agama.Storage1.ISCSI.Node": return cockpitProxies.iscsiNode[path];
    case "org.opensuse.Agama.Storage1.DASD.Manager": return cockpitProxies.dasdManager;
    case "org.opensuse.Agama.Storage1.ZFCP.Manager": return cockpitProxies.zfcpManager;
    case "org.opensuse.Agama.Storage1.ZFCP.Controller": return cockpitProxies.zfcpController[path];
  }
};

const mockProxies = (iface) => {
  switch (iface) {
    case "org.opensuse.Agama.Storage1.ISCSI.Node": return cockpitProxies.iscsiNodes;
    case "org.opensuse.Agama.Storage1.DASD.Device": return cockpitProxies.dasdDevices;
    case "org.opensuse.Agama.Storage1.ZFCP.Controller": return cockpitProxies.zfcpControllers;
    case "org.opensuse.Agama.Storage1.ZFCP.Disk": return cockpitProxies.zfcpDisks;
  }
};

const mockOnObjectChanged = (path, iface, handler) => {
  if (!cockpitCallbacks[path]) cockpitCallbacks[path] = {};
  cockpitCallbacks[path][iface] = handler;
};

const emitSignal = (path, iface, data) => {
  if (!cockpitCallbacks[path]) return;

  const handler = cockpitCallbacks[path][iface];
  if (!handler) return;

  return handler(data);
};

const mockCall = (_path, iface, method) => {
  if (iface === "org.freedesktop.DBus.ObjectManager" && method === "GetManagedObjects")
    return [managedObjects];
};

const reset = () => {
  cockpitProxies.iscsiInitiator = {};
  cockpitProxies.iscsiNodes = {};
  cockpitProxies.iscsiNode = {};
  cockpitProxies.dasdManager = {};
  cockpitProxies.dasdDevices = {};
  cockpitProxies.zfcpManager = {};
  cockpitProxies.zfcpControllers = {};
  cockpitProxies.zfcpDisks = {};
  cockpitProxies.zfcpController = {};
  managedObjects = {};
};

let mockJsonFn;
let mockGetFn;
let mockPostFn;
let mockPutFn;
let mockDeleteFn;
let mockPatchFn;
let mockHTTPClient;
let http;

jest.mock("./http", () => {
  return {
    HTTPClient: jest.fn().mockImplementation(() => mockHTTPClient)
  };
});

beforeEach(() => {
  reset();

  // @ts-ignore
  DBusClient.mockImplementation(() => {
    return {
      proxy: mockProxy,
      proxies: mockProxies,
      onObjectChanged: mockOnObjectChanged,
      call: mockCall
    };
  });

  mockJsonFn = jest.fn();
  mockGetFn = jest.fn().mockImplementation(() => {
    return { ok: true, json: mockJsonFn };
  });
  mockPostFn = jest.fn().mockImplementation(() => {
    return { ok: true };
  });
  mockPutFn = jest.fn().mockImplementation(() => {
    return { ok: true };
  });
  mockDeleteFn = jest.fn().mockImplementation(() => {
    return {
      ok: true,
    };
  });
  mockPatchFn = jest.fn().mockImplementation(() => {
    return { ok: true };
  });

  mockHTTPClient = {
    get: mockGetFn,
    patch: mockPatchFn,
    post: mockPostFn,
    put: mockPutFn,
    delete: mockDeleteFn,
  };

  http = new HTTPClient(new URL("http://localhost"));
});

let client;

describe("#probe", () => {
  beforeEach(() => {
    client = new StorageClient(http);
  });

  it("probes the system", async () => {
    await client.probe();
    expect(mockPostFn).toHaveBeenCalledWith("/storage/probe");
  });
});

describe("#isDeprecated", () => {
  describe("if the system is deprecated", () => {
    beforeEach(() => {
      mockJsonFn.mockResolvedValue(true);
      client = new StorageClient(http);
    });

    it("returns true", async () => {
      const result = await client.isDeprecated();
      expect(result).toEqual(true);
    });
  });

  describe("if the system is not deprecated", () => {
    beforeEach(() => {
      mockGetFn.mockResolvedValue(false);
      client = new StorageClient(http);
    });

    it("returns false", async () => {
      const result = await client.isDeprecated();
      expect(result).toEqual(false);
    });
  });

  describe("when the HTTP call fails", () => {
    beforeEach(() => {
      mockGetFn.mockImplementation(path => {
        if (path === "/storage/devices/dirty")
          return { ok: false, json: undefined };
        else
          return { ok: true, json: mockJsonFn };
      }
      );

      client = new StorageClient(http);
    });

    it("returns false", async () => {
      const result = await client.isDeprecated();
      expect(result).toEqual(false);
    });
  });
});

// @fixme We need to rethink signals mocking, now that we switched from DBus to HTTP
describe.skip("#onDeprecate", () => {
  const handler = jest.fn();

  beforeEach(() => {
    client = new StorageClient();
    client.onDeprecate(handler);
  });

  describe("if the system was not deprecated", () => {
    beforeEach(() => {
      emitSignal(
        "/org/opensuse/Agama/Storage1",
        "org.opensuse.Agama.Storage1",
        {});
    });

    it("does not run the handler", async () => {
      expect(handler).not.toHaveBeenCalled();
    });
  });

  describe("if the system was deprecated", () => {
    beforeEach(() => {
      emitSignal(
        "/org/opensuse/Agama/Storage1",
        "org.opensuse.Agama.Storage1",
        { DeprecatedSystem: true });
    });

    it("runs the handler", async () => {
      expect(handler).not.toHaveBeenCalled();
    });
  });
});

describe("#getIssues", () => {
  beforeEach(() => {
    client = new StorageClient(http);
  });

  describe("if there are no issues", () => {
    beforeEach(() => {
      mockJsonFn.mockResolvedValue([]);
    });

    it("returns an empty list", async () => {
      const issues = await client.getIssues();
      expect(issues).toEqual([]);
    });
  });

  describe("if there are issues", () => {
    beforeEach(() => {
      mockJsonFn.mockResolvedValue(contexts.withIssues());
    });

    it("returns the list of issues", async () => {
      const issues = await client.getIssues();
      expect(issues).toEqual(expect.arrayContaining([
        { description: "Issue 1", details: "", source: "system", severity: "error" },
        { description: "Issue 2", details: "", source: "system", severity: "warn" },
        { description: "Issue 3", details: "", source: "config", severity: "error" }
      ]));
    });
  });
});

describe("#getErrors", () => {
  beforeEach(() => {
    client = new StorageClient(http);
    mockJsonFn.mockResolvedValue(contexts.withIssues());
  });

  it("returns the issues with error severity", async () => {
    const errors = await client.getErrors();
    expect(errors.map(e => e.description)).toEqual(expect.arrayContaining(["Issue 1", "Issue 3"]));
  });
});

// @fixme See note at the test of onDeprecate about mocking signals
describe.skip("#onIssuesChange", () => {
  it("runs the handler when the issues change", async () => {
    client = new StorageClient();

    const handler = jest.fn();
    client.onIssuesChange(handler);

    emitSignal(
      "/org/opensuse/Agama/Storage1",
      "org.opensuse.Agama1.Issues",
      { All: { v: [["Issue 1", "", 1, 0], ["Issue 2", "", 2, 1]] } });

    expect(handler).toHaveBeenCalledWith([
      { description: "Issue 1", details: "", source: "system", severity: "warn" },
      { description: "Issue 2", details: "", source: "config", severity: "error" },
    ]);
  });
});

describe("#system", () => {
  describe("#getDevices", () => {
    beforeEach(() => {
      client = new StorageClient(http);
    });

    describe("when there are devices", () => {
      beforeEach(() => {
        mockJsonFn.mockResolvedValue(contexts.withSystemDevices());
      });

      it("returns the system devices", async () => {
        const devices = await client.system.getDevices();
        expect(devices).toEqual(Object.values(systemDevices));
      });
    });

    describe("when there are not devices", () => {
      beforeEach(() => {
        mockJsonFn.mockResolvedValue([]);
      });

      it("returns an empty list", async () => {
        const devices = await client.system.getDevices();
        expect(devices).toEqual([]);
      });
    });

    describe("when the HTTP call fails", () => {
      beforeEach(() => {
        mockGetFn.mockImplementation(path => {
          if (path === "/storage/devices/system")
            return { ok: false, json: undefined };
          else
            return { ok: true, json: mockJsonFn };
        }
        );

        client = new StorageClient(http);
      });

      it("returns an empty list", async () => {
        const devices = await client.system.getDevices();
        expect(devices).toEqual([]);
      });
    });
  });
});

describe("#staging", () => {
  describe("#getDevices", () => {
    beforeEach(() => {
      client = new StorageClient(http);
    });

    describe("when there are devices", () => {
      beforeEach(() => {
        mockJsonFn.mockResolvedValue(contexts.withStagingDevices());
      });

      it("returns the staging devices", async () => {
        const devices = await client.staging.getDevices();
        expect(devices).toEqual(Object.values(stagingDevices));
      });
    });

    describe("when there are not devices", () => {
      beforeEach(() => {
        mockJsonFn.mockResolvedValue([]);
      });

      it("returns an empty list", async () => {
        const devices = await client.staging.getDevices();
        expect(devices).toEqual([]);
      });
    });

    describe("when the HTTP call fails", () => {
      beforeEach(() => {
        mockGetFn.mockImplementation(path => {
          if (path === "/storage/devices/result")
            return { ok: false, json: undefined };
          else
            return { ok: true, json: mockJsonFn };
        }
        );

        client = new StorageClient(http);
      });

      it("returns an empty list", async () => {
        const devices = await client.staging.getDevices();
        expect(devices).toEqual([]);
      });
    });
  });
});

describe("#proposal", () => {
  describe("#getAvailableDevices", () => {
    let response;

    beforeEach(() => {
      response = { ok: true, json: jest.fn().mockResolvedValue(contexts.withAvailableDevices()) };

      mockGetFn.mockImplementation(path => {
        switch (path) {
          case "/storage/devices/system":
            return { ok: true, json: jest.fn().mockResolvedValue(contexts.withSystemDevices()) };
          case "/storage/proposal/usable_devices":
            return response;
          default:
            return { ok: true, json: mockJsonFn };
        }
      });

      client = new StorageClient(http);
    });

    it("returns the list of available devices", async () => {
      const availableDevices = await client.proposal.getAvailableDevices();
      expect(availableDevices).toEqual([systemDevices.sda, systemDevices.sdb]);
    });

    describe("when the HTTP call fails", () => {
      beforeEach(() => {
        response = { ok: false, json: undefined };
      });

      it("returns an empty list", async () => {
        const availableDevices = await client.proposal.getAvailableDevices();
        expect(availableDevices).toEqual([]);
      });
    });
  });

  describe("#getProductMountPoints", () => {
    beforeEach(() => {
      mockJsonFn.mockResolvedValue({ mountPoints: ["/", "swap", "/home"] });
      client = new StorageClient(http);
    });

    it("returns the list of product mount points", async () => {
      const mount_points = await client.proposal.getProductMountPoints();
      expect(mount_points).toEqual(["/", "swap", "/home"]);
    });

    describe("when the HTTP call fails", () => {
      beforeEach(() => {
        mockGetFn.mockImplementation(path => {
          if (path === "/storage/product/params")
            return { ok: false, json: undefined };
          else
            return { ok: true, json: mockJsonFn };
        }
        );

        client = new StorageClient(http);
      });

      it("returns an empty list", async () => {
        const mount_points = await client.proposal.getProductMountPoints();
        expect(mount_points).toEqual([]);
      });
    });
  });

  describe("#getEncryptionMethods", () => {
    beforeEach(() => {
      mockJsonFn.mockResolvedValue({ encryptionMethods: ["luks1", "luks2"] });
      client = new StorageClient(http);
    });

    it("returns the list of encryption methods", async () => {
      const encryptionMethods = await client.proposal.getEncryptionMethods();
      expect(encryptionMethods).toEqual(["luks1", "luks2"]);
    });

    describe("when the HTTP call fails", () => {
      beforeEach(() => {
        mockGetFn.mockImplementation(path => {
          if (path === "/storage/product/params")
            return { ok: false, json: undefined };
          else
            return { ok: true, json: mockJsonFn };
        }
        );

        client = new StorageClient(http);
      });

      it("returns an empty list", async () => {
        const encryptionMethods = await client.proposal.getEncryptionMethods();
        expect(encryptionMethods).toEqual([]);
      });
    });
  });

  describe("#defaultVolume", () => {
    let response;

    beforeEach(() => {
      response = (path) => {
        const param = path.split("=")[1];
        switch (param) {
          case "%2Fhome":
            return {
              ok: true,
              json: jest.fn().mockResolvedValue({
                mountPath: "/home",
                target: "default",
                targetDevice: "",
                fsType: "XFS",
                minSize: 2048,
                maxSize: 4096,
                autoSize: false,
                snapshots: false,
                transactional: false,
                outline: {
                  required: false,
                  fsTypes: ["Ext4", "XFS"],
                  supportAutoSize: false,
                  snapshotsConfigurable: false,
                  snapshotsAffectSizes: false,
                  adjustByRam: false,
                  sizeRelevantVolumes: []
                }
              })
            };
          default:
            return {
              ok: true,
              json: jest.fn().mockResolvedValue({
                mountPath: "",
                target: "default",
                targetDevice: "",
                fsType: "Ext4",
                minSize: 1024,
                maxSize: 2048,
                autoSize: false,
                snapshots: false,
                transactional: false,
                outline: {
                  required: false,
                  fsTypes: ["Ext4", "XFS"],
                  supportAutoSize: false,
                  snapshotsConfigurable: false,
                  snapshotsAffectSizes: false,
                  adjustByRam: false,
                  sizeRelevantVolumes: []
                }
              })
            };
        }
      };

      mockGetFn.mockImplementation(path => {
        switch (path) {
          case "/storage/devices/system":
            return { ok: true, json: jest.fn().mockResolvedValue(contexts.withSystemDevices()) };
          case "/storage/product/params":
            return { ok: true, json: jest.fn().mockResolvedValue({ mountPoints: ["/", "swap", "/home"] }) };
          // GET for /storage/product/volume_for?path=XX
          default:
            return response(path);
        }
      });

      client = new StorageClient(http);
    });

    it("returns the default volume for the given path", async () => {
      const home = await client.proposal.defaultVolume("/home");

      expect(home).toStrictEqual({
        mountPath: "/home",
        target: "DEFAULT",
        targetDevice: undefined,
        fsType: "XFS",
        minSize: 2048,
        maxSize: 4096,
        autoSize: false,
        snapshots: false,
        transactional: false,
        outline: {
          required: false,
          fsTypes: ["Ext4", "XFS"],
          supportAutoSize: false,
          snapshotsConfigurable: false,
          snapshotsAffectSizes: false,
          adjustByRam: false,
          sizeRelevantVolumes: [],
          productDefined: true
        }
      });

      const generic = await client.proposal.defaultVolume("");

      expect(generic).toStrictEqual({
        mountPath: "",
        target: "DEFAULT",
        targetDevice: undefined,
        fsType: "Ext4",
        minSize: 1024,
        maxSize: 2048,
        autoSize: false,
        snapshots: false,
        transactional: false,
        outline: {
          required: false,
          fsTypes: ["Ext4", "XFS"],
          supportAutoSize: false,
          snapshotsConfigurable: false,
          snapshotsAffectSizes: false,
          adjustByRam: false,
          sizeRelevantVolumes: [],
          productDefined: false
        }
      });
    });

    describe("when then HTTP call fails", () => {
      beforeEach(() => {
        response = () => ({ ok: false, json: undefined });
      });

      it("returns undefined", async () => {
        const volume = await client.proposal.defaultVolume("/home");
        expect(volume).toBeUndefined();
      });
    });
  });

  describe("#getResult", () => {
    beforeEach(() => {
      client = new StorageClient(http);
    });

    describe("if there is no proposal yet", () => {
      beforeEach(() => {
        mockGetFn.mockImplementation(() => {
          return { ok: false };
        });
      });

      it("returns undefined", async () => {
        const result = await client.proposal.getResult();
        expect(result).toBe(undefined);
      });
    });

    describe("if there is a proposal", () => {
      beforeEach(() => {
        const proposal = contexts.withProposal();
        mockJsonFn.mockResolvedValue(proposal.settings);

        mockGetFn.mockImplementation(path => {
          switch (path) {
            case "/storage/devices/system":
              return { ok: true, json: jest.fn().mockResolvedValue(contexts.withSystemDevices()) };
            case "/storage/proposal/settings":
              return { ok: true, json: mockJsonFn };
            case "/storage/proposal/actions":
              return { ok: true, json: jest.fn().mockResolvedValue(proposal.actions) };
            case "/storage/product/params":
              return { ok: true, json: jest.fn().mockResolvedValue({ mountPoints: ["/", "swap"] }) };
          }
        });
      });

      it("returns the proposal settings and actions", async () => {
        const { settings, actions } = await client.proposal.getResult();

        expect(settings).toMatchObject({
          target: "NEW_LVM_VG",
          targetPVDevices: ["/dev/sda", "/dev/sdb"],
          configureBoot: true,
          bootDevice: "/dev/sda",
          defaultBootDevice: "/dev/sdb",
          encryptionPassword: "00000",
          spacePolicy: "custom",
          spaceActions: [
            { device: "/dev/sda", action: "force_delete" },
            { device: "/dev/sdb", action: "resize" }
          ],
          volumes: [
            {
              mountPath: "/",
              target: "DEFAULT",
              targetDevice: undefined,
              fsType: "Btrfs",
              minSize: 1024,
              maxSize: 2048,
              autoSize: true,
              snapshots: true,
              transactional: true,
              outline: {
                required: true,
                fsTypes: ["Btrfs", "Ext3"],
                supportAutoSize: true,
                snapshotsConfigurable: true,
                snapshotsAffectSizes: true,
                sizeRelevantVolumes: ["/home"],
                productDefined: true
              }
            },
            {
              mountPath: "/home",
              target: "DEFAULT",
              targetDevice: undefined,
              fsType: "XFS",
              minSize: 2048,
              maxSize: 4096,
              autoSize: false,
              snapshots: false,
              transactional: false,
              outline: {
                required: false,
                fsTypes: ["Ext4", "XFS"],
                supportAutoSize: false,
                snapshotsConfigurable: false,
                snapshotsAffectSizes: false,
                sizeRelevantVolumes: [],
                productDefined: false
              }
            }
          ]
        });

        expect(settings.installationDevices.map(d => d.name).sort()).toStrictEqual(
          ["/dev/sda", "/dev/sdb"].sort()
        );

        expect(actions).toStrictEqual([
          { device: 2, text: "Mount /dev/sdb1 as root", subvol: false, delete: false }
        ]);
      });

      describe("if boot is not configured", () => {
        beforeEach(() => {
          mockJsonFn.mockResolvedValue(
            { ...contexts.withProposal().settings, configureBoot: false, bootDevice: "/dev/sdc" }
          );
        });

        it("does not include the boot device as installation device", async () => {
          const { settings } = await client.proposal.getResult();
          expect(settings.installationDevices).toEqual([sda, sdb]);
        });
      });
    });
  });

  describe("#calculate", () => {
    beforeEach(() => {
      client = new StorageClient(http);
    });

    it("calculates a default proposal when no settings are given", async () => {
      await client.proposal.calculate({});
      expect(mockPutFn).toHaveBeenCalledWith("/storage/proposal/settings", {});
    });

    it("calculates a proposal with the given settings", async () => {
      await client.proposal.calculate({
        target: "DISK",
        targetDevice: "/dev/vdc",
        configureBoot: true,
        bootDevice: "/dev/vdb",
        encryptionPassword: "12345",
        spacePolicy: "custom",
        spaceActions: [{ device: "/dev/sda", action: "resize" }],
        volumes: [
          {
            mountPath: "/test1",
            fsType: "Btrfs",
            minSize: 1024,
            maxSize: 2048,
            autoSize: false,
            snapshots: true
          },
          {
            mountPath: "/test2",
            minSize: 1024
          }
        ]
      });

      expect(mockPutFn).toHaveBeenCalledWith("/storage/proposal/settings", {
        target: "disk",
        targetDevice: "/dev/vdc",
        configureBoot: true,
        bootDevice: "/dev/vdb",
        encryptionPassword: "12345",
        spacePolicy: "custom",
        spaceActions: [{ device: "/dev/sda", action: "resize" }],
        volumes: [
          {
            mountPath: "/test1",
            fsType: "Btrfs",
            minSize: 1024,
            maxSize: 2048,
            autoSize: false,
            snapshots: true
          },
          {
            mountPath: "/test2",
            minSize: 1024
          }
        ]
      });
    });

    it("calculates a proposal without space actions if the policy is not custom", async () => {
      await client.proposal.calculate({
        spacePolicy: "delete",
        spaceActions: [{ device: "/dev/sda", action: "resize" }],
      });

      expect(mockPutFn).toHaveBeenCalledWith("/storage/proposal/settings", { spacePolicy: "delete" });
    });
  });
});

describe.skip("#dasd", () => {
  const sampleDasdDevice = {
    id: "8",
    accessType: "",
    channelId: "0.0.019e",
    diag: false,
    enabled: true,
    formatted: false,
    hexId: 414,
    name: "sample_dasd_device",
    partitionInfo: "",
    type: "ECKD"
  };

  const probeFn = jest.fn();
  const setDiagFn = jest.fn();
  const enableFn = jest.fn();
  const disableFn = jest.fn();

  beforeEach(() => {
    client = new StorageClient();
    cockpitProxies.dasdManager = {
      Probe: probeFn,
      SetDiag: setDiagFn,
      Enable: enableFn,
      Disable: disableFn
    };
    contexts.withDASDDevices();
  });

  describe("#getDevices", () => {
    it("triggers probing", async () => {
      await client.dasd.getDevices();
      expect(probeFn).toHaveBeenCalled();
    });

    describe("if there is no exported DASD devices yet", () => {
      beforeEach(() => {
        contexts.withoutDASDDevices();
      });

      it("returns an empty list", async () => {
        const result = await client.dasd.getDevices();
        expect(result).toStrictEqual([]);
      });
    });

    describe("if there are exported DASD devices", () => {
      it("returns a list with the exported DASD devices", async () => {
        const result = await client.dasd.getDevices();
        expect(result.length).toEqual(2);
        expect(result).toContainEqual({
          id: "8",
          accessType: "",
          channelId: "0.0.019e",
          diag: false,
          enabled: true,
          formatted: false,
          hexId: 414,
          name: "dasd_sample_8",
          partitionInfo: "",
          type: "ECKD"
        });
        expect(result).toContainEqual({
          id: "9",
          accessType: "rw",
          channelId: "0.0.ffff",
          diag: false,
          enabled: true,
          formatted: false,
          hexId: 65535,
          name: "dasd_sample_9",
          partitionInfo: "/dev/dasd_sample_9",
          type: "FBA"
        });
      });
    });
  });

  describe("#setDIAG", () => {
    it("requests for setting DIAG for given devices", async () => {
      await client.dasd.setDIAG([sampleDasdDevice], true);
      expect(setDiagFn).toHaveBeenCalledWith(
        ["/org/opensuse/Agama/Storage1/dasds/8"],
        true
      );

      await client.dasd.setDIAG([sampleDasdDevice], false);
      expect(setDiagFn).toHaveBeenCalledWith(
        ["/org/opensuse/Agama/Storage1/dasds/8"],
        false
      );
    });
  });

  describe("#enableDevices", () => {
    it("requests for enabling given devices", async () => {
      await client.dasd.enableDevices([sampleDasdDevice]);
      expect(enableFn).toHaveBeenCalledWith(["/org/opensuse/Agama/Storage1/dasds/8"]);
    });
  });

  describe("#disableDevices", () => {
    it("requests for disabling given devices", async () => {
      await client.dasd.disableDevices([sampleDasdDevice]);
      expect(disableFn).toHaveBeenCalledWith(["/org/opensuse/Agama/Storage1/dasds/8"]);
    });
  });
});

describe.skip("#zfcp", () => {
  const probeFn = jest.fn();
  let controllersCallbacks;
  let disksCallbacks;

  const mockEventListener = (proxy, callbacks) => {
    proxy.addEventListener = jest.fn().mockImplementation(
      (signal, handler) => {
        if (!callbacks[signal]) callbacks[signal] = [];
        callbacks[signal].push(handler);
      }
    );

    proxy.removeEventListener = jest.fn();
  };

  const emitSignals = (callbacks, signal, proxy) => {
    callbacks[signal].forEach(handler => handler(null, proxy));
  };

  beforeEach(() => {
    client = new StorageClient();
    cockpitProxies.zfcpManager = {
      Probe: probeFn,
      AllowLUNScan: true
    };

    controllersCallbacks = {};
    mockEventListener(cockpitProxies.zfcpControllers, controllersCallbacks);

    disksCallbacks = {};
    mockEventListener(cockpitProxies.zfcpDisks, disksCallbacks);
  });

  describe("#isSupported", () => {
    describe("if zFCP manager is available", () => {
      it("returns true", async () => {
        const result = await client.zfcp.isSupported();
        expect(result).toEqual(true);
      });
    });

    describe("if zFCP manager is not available", () => {
      beforeEach(() => {
        cockpitProxies.zfcpManager = undefined;
      });

      it("returns false", async () => {
        const result = await client.zfcp.isSupported();
        expect(result).toEqual(false);
      });
    });
  });

  describe("#getAllowLUNScan", () => {
    it("returns whether allow_lun_scan is active", async () => {
      const result = await client.zfcp.getAllowLUNScan();
      expect(result).toEqual(true);
    });

    describe("if zFCP manager is not available", () => {
      beforeEach(() => {
        cockpitProxies.zfcpManager = undefined;
      });

      it("returns undefined", async () => {
        const result = await client.zfcp.getAllowLUNScan();
        expect(result).toBeUndefined();
      });
    });
  });

  describe("#probe", () => {
    it("triggers probing", async () => {
      await client.zfcp.probe();
      expect(probeFn).toHaveBeenCalled();
    });

    describe("if zFCP manager is not available", () => {
      beforeEach(() => {
        cockpitProxies.zfcpManager = undefined;
      });

      it("returns undefined", async () => {
        const result = await client.zfcp.probe();
        expect(result).toBeUndefined();
      });
    });
  });

  describe("#getControllers", () => {
    describe("if there is no exported zFCP controllers yet", () => {
      beforeEach(() => {
        contexts.withoutZFCPControllers();
      });

      it("returns an empty list", async () => {
        const result = await client.zfcp.getControllers();
        expect(result).toStrictEqual([]);
      });
    });

    describe("if there are exported ZFCP controllers", () => {
      beforeEach(() => {
        contexts.withZFCPControllers();
      });

      it("returns a list with the exported ZFCP controllers", async () => {
        const result = await client.zfcp.getControllers();
        expect(result.length).toEqual(2);
        expect(result).toContainEqual({
          id: "1",
          active: false,
          lunScan: false,
          channel: "0.0.fa00"
        });
        expect(result).toContainEqual({
          id: "2",
          active: false,
          lunScan: false,
          channel: "0.0.fc00"
        });
      });
    });
  });

  describe("#getDisks", () => {
    describe("if there is no exported zFCP disks yet", () => {
      beforeEach(() => {
        contexts.withoutZFCPDisks();
      });

      it("returns an empty list", async () => {
        const result = await client.zfcp.getDisks();
        expect(result).toStrictEqual([]);
      });
    });

    describe("if there are exported ZFCP disks", () => {
      beforeEach(() => {
        contexts.withZFCPDisks();
      });

      it("returns a list with the exported ZFCP disks", async () => {
        const result = await client.zfcp.getDisks();
        expect(result.length).toEqual(2);
        expect(result).toContainEqual({
          id: "1",
          name: "/dev/sda",
          channel: "0.0.fa00",
          wwpn: "0x500507630703d3b3",
          lun: "0x0000000000000000"
        });
        expect(result).toContainEqual({
          id: "2",
          name: "/dev/sdb",
          channel: "0.0.fa00",
          wwpn: "0x500507630703d3b3",
          lun: "0x0000000000000001"
        });
      });
    });
  });

  describe("#getWWPNs", () => {
    const wwpns = ["0x500507630703d3b3", "0x500507630708d3b3"];

    const controllerProxy = {
      GetWWPNs: jest.fn().mockReturnValue(wwpns)
    };

    beforeEach(() => {
      cockpitProxies.zfcpController = {
        "/org/opensuse/Agama/Storage1/zfcp_controllers/1": controllerProxy
      };
    });

    it("returns a list with the WWPNs of the zFCP controller", async () => {
      const result = await client.zfcp.getWWPNs({ id: "1" });
      expect(result).toStrictEqual(wwpns);
    });

    describe("if there is no proxy", () => {
      beforeEach(() => {
        cockpitProxies.zfcpController = {};
      });

      it("returns undefined", async () => {
        const result = await client.zfcp.getWWPNs({ id: "1" });
        expect(result).toBeUndefined();
      });
    });
  });

  describe("#getLUNs", () => {
    const luns = {
      "0x500507630703d3b3": ["0x0000000000000000", "0x0000000000000001", "0x0000000000000002"]
    };

    const controllerProxy = {
      GetLUNs: jest.fn().mockImplementation(wwpn => luns[wwpn])
    };

    beforeEach(() => {
      cockpitProxies.zfcpController = {
        "/org/opensuse/Agama/Storage1/zfcp_controllers/1": controllerProxy
      };
    });

    it("returns a list with the LUNs for a WWPN of the zFCP controller", async () => {
      const result = await client.zfcp.getLUNs({ id: "1" }, "0x500507630703d3b3");
      expect(result).toStrictEqual(luns["0x500507630703d3b3"]);
    });

    describe("if there is no proxy", () => {
      beforeEach(() => {
        cockpitProxies.zfcpController = {};
      });

      it("returns undefined", async () => {
        const result = await client.zfcp.getLUNs({ id: "1" }, "0x500507630703d3b3");
        expect(result).toBeUndefined();
      });
    });
  });

  describe("#activateController", () => {
    const activateFn = jest.fn().mockReturnValue(0);

    const controllerProxy = {
      Activate: activateFn
    };

    beforeEach(() => {
      cockpitProxies.zfcpController = {
        "/org/opensuse/Agama/Storage1/zfcp_controllers/1": controllerProxy
      };
    });

    it("tries to activate the given zFCP controller", async () => {
      const result = await client.zfcp.activateController({ id: "1" });
      expect(activateFn).toHaveBeenCalled();
      expect(result).toEqual(0);
    });

    describe("if there is no proxy", () => {
      beforeEach(() => {
        cockpitProxies.zfcpController = {};
      });

      it("returns undefined", async () => {
        const result = await client.zfcp.activateController({ id: "1" });
        expect(result).toBeUndefined();
      });
    });
  });

  describe("#activateDisk", () => {
    const activateDiskFn = jest.fn().mockReturnValue(0);

    const controllerProxy = {
      ActivateDisk: activateDiskFn
    };

    beforeEach(() => {
      cockpitProxies.zfcpController = {
        "/org/opensuse/Agama/Storage1/zfcp_controllers/1": controllerProxy
      };
    });

    it("tries to activate the given zFCP disk", async () => {
      const result = await client.zfcp.activateDisk({ id: "1" }, "0x500507630703d3b3", "0x0000000000000000");
      expect(activateDiskFn).toHaveBeenCalledWith("0x500507630703d3b3", "0x0000000000000000");
      expect(result).toEqual(0);
    });

    describe("if there is no proxy", () => {
      beforeEach(() => {
        cockpitProxies.zfcpController = {};
      });

      it("returns undefined", async () => {
        const result = await client.zfcp.activateDisk({ id: "1" }, "0x500507630703d3b3", "0x0000000000000000");
        expect(result).toBeUndefined();
      });
    });
  });

  describe("#deactivateDisk", () => {
    const deactivateDiskFn = jest.fn().mockReturnValue(0);

    const controllerProxy = {
      ActivateDisk: deactivateDiskFn
    };

    beforeEach(() => {
      cockpitProxies.zfcpController = {
        "/org/opensuse/Agama/Storage1/zfcp_controllers/1": controllerProxy
      };
    });

    it("tries to deactivate the given zFCP disk", async () => {
      const result = await client.zfcp.activateDisk({ id: "1" }, "0x500507630703d3b3", "0x0000000000000000");
      expect(deactivateDiskFn).toHaveBeenCalledWith("0x500507630703d3b3", "0x0000000000000000");
      expect(result).toEqual(0);
    });

    describe("if there is no proxy", () => {
      beforeEach(() => {
        cockpitProxies.zfcpController = {};
      });

      it("returns undefined", async () => {
        const result = await client.zfcp.deactivateDisk({ id: "1" }, "0x500507630703d3b3", "0x0000000000000000");
        expect(result).toBeUndefined();
      });
    });
  });

  describe("#onControllerChanged", () => {
    it("runs the handler when a zFCP controller changes", async () => {
      const handler = jest.fn();
      await client.zfcp.onControllerChanged(handler);

      emitSignals(controllersCallbacks, "changed", {
        path: "/org/opensuse/Agama/Storage1/zfcp_controllers/1",
        Active: true,
        LUNScan: true,
        Channel: "0.0.fa00"
      });

      expect(handler).toHaveBeenCalledWith({
        id: "1", active: true, lunScan: true, channel: "0.0.fa00"
      });
    });
  });

  describe("#onDiskAdded", () => {
    it("runs the handler when a zFCP disk is added", async () => {
      const handler = jest.fn();
      await client.zfcp.onDiskAdded(handler);

      emitSignals(disksCallbacks, "added", {
        path: "/org/opensuse/Agama/Storage1/zfcp_disks/1",
        Name: "/dev/sda",
        Channel: "0.0.fa00",
        WWPN: "0x500507630703d3b3",
        LUN: "0x0000000000000000"
      });

      expect(handler).toHaveBeenCalledWith({
        id: "1",
        name: "/dev/sda",
        channel: "0.0.fa00",
        wwpn: "0x500507630703d3b3",
        lun: "0x0000000000000000"
      });
    });
  });

  describe("#onDiskChanged", () => {
    it("runs the handler when a zFCP disk changes", async () => {
      const handler = jest.fn();
      await client.zfcp.onDiskChanged(handler);

      emitSignals(disksCallbacks, "changed", {
        path: "/org/opensuse/Agama/Storage1/zfcp_disks/1",
        Name: "/dev/sda",
        Channel: "0.0.fa00",
        WWPN: "0x500507630703d3b3",
        LUN: "0x0000000000000000"
      });

      expect(handler).toHaveBeenCalledWith({
        id: "1",
        name: "/dev/sda",
        channel: "0.0.fa00",
        wwpn: "0x500507630703d3b3",
        lun: "0x0000000000000000"
      });
    });
  });

  describe("#onDiskRemoved", () => {
    it("runs the handler when a zFCP disk is removed", async () => {
      const handler = jest.fn();
      await client.zfcp.onDiskRemoved(handler);

      emitSignals(disksCallbacks, "removed", {
        path: "/org/opensuse/Agama/Storage1/zfcp_disks/1",
        Name: "/dev/sda",
        Channel: "0.0.fa00",
        WWPN: "0x500507630703d3b3",
        LUN: "0x0000000000000000"
      });

      expect(handler).toHaveBeenCalledWith({
        id: "1",
        name: "/dev/sda",
        channel: "0.0.fa00",
        wwpn: "0x500507630703d3b3",
        lun: "0x0000000000000000"
      });
    });
  });
});

describe("#iscsi", () => {
  beforeEach(() => {
    client = new StorageClient(new HTTPClient(new URL("http://localhost")));
  });

  describe("#getInitiator", () => {
    beforeEach(() => {
      mockGetFn.mockResolvedValue({ ok: true, json: mockJsonFn });
      mockJsonFn.mockResolvedValue({
        name: "iqn.1996-04.com.suse:01:351e6d6249",
        ibft: false,
      });
    });

    it("returns the current initiator", async () => {
      const { name, ibft } = await client.iscsi.getInitiator();
      expect(name).toEqual("iqn.1996-04.com.suse:01:351e6d6249");
      expect(ibft).toEqual(false);
    });

    describe("when the HTTP call fails", () => {
      beforeEach(() => {
        mockGetFn.mockResolvedValue({ ok: false, json: undefined });
      });

      it("returns undefined", async () => {
        const initiator = await client.iscsi.getInitiator();
        expect(initiator).toBeUndefined();
      });
    });
  });

  describe("#setInitiatorName", () => {
    beforeEach(() => {
      cockpitProxies.iscsiInitiator = {
        InitiatorName: "iqn.1996-04.com.suse:01:351e6d6249",
      };
    });

    it("sets the given initiator name", async () => {
      await client.iscsi.setInitiatorName("test");
      expect(mockPatchFn).toHaveBeenCalledWith("/storage/iscsi/initiator", { name: "test" });
    });
  });

  describe("#getNodes", () => {
    describe("if there is no exported iSCSI nodes yet", () => {
      beforeEach(() => {
        mockJsonFn.mockResolvedValue([]);
      });

      it("returns an empty list", async () => {
        const result = await client.iscsi.getNodes();
        expect(result).toStrictEqual([]);
      });
    });

    describe("if there are exported iSCSI nodes", () => {
      beforeEach(() => {
        mockJsonFn.mockResolvedValue(contexts.withISCSINodes());
      });

      it("returns a list with the exported iSCSI nodes", async () => {
        const result = await client.iscsi.getNodes();
        expect(result.length).toEqual(2);
        expect(result).toContainEqual({
          id: 1,
          target: "iqn.2023-01.com.example:37dac",
          address: "192.168.100.101",
          port: 3260,
          interface: "default",
          ibft: false,
          connected: false,
          startup: "",
        });
        expect(result).toContainEqual({
          id: 2,
          target: "iqn.2023-01.com.example:74afb",
          address: "192.168.100.102",
          port: 3260,
          interface: "default",
          ibft: true,
          connected: true,
          startup: "onboot",
        });
      });

      describe("when the HTTP call fails", () => {
        beforeEach(() => {
          mockGetFn.mockResolvedValue({ ok: false, json: undefined });
        });

        it("returns an empty list", async () => {
          const result = await client.iscsi.getNodes();
          expect(result).toStrictEqual([]);
        });
      });
    });
  });

  describe("#discover", () => {
    it("performs an iSCSI discovery with the given options", async () => {
      const options = {
        username: "test",
        password: "12345",
        reverseUsername: "target",
        reversePassword: "nonsecret",
      };
      await client.iscsi.discover("192.168.100.101", 3260, options);
      expect(mockPostFn).toHaveBeenCalledWith(
        "/storage/iscsi/discover",
        { address: "192.168.100.101", port: 3260, options },
      );
    });
  });

  describe("#delete", () => {
    it("deletes the given iSCSI node", async () => {
      await client.iscsi.delete({ id: "1" });
      expect(mockDeleteFn).toHaveBeenCalledWith(
        "/storage/iscsi/nodes/1",
      );
    });
  });

  describe("#login", () => {
    const auth = {
      username: "test",
      password: "12345",
      reverseUsername: "target",
      reversePassword: "nonsecret",
      startup: "automatic",
    };

    it("performs an iSCSI login with the given options", async () => {
      const result = await client.iscsi.login({ id: "1" }, auth);

      expect(result).toEqual(0);
      expect(mockPostFn).toHaveBeenCalledWith(
        "/storage/iscsi/nodes/1/login",
        auth,
      );
    });

    it("returns 1 when the startup is invalid", async () => {
      mockPostFn.mockImplementation(() => (
        { ok: false, json: mockJsonFn }
      ));
      mockJsonFn.mockResolvedValue("InvalidStartup");

      const result = await client.iscsi.login({ id: "1" }, { ...auth, startup: "invalid" });
      expect(result).toEqual(1);
    });

    it("returns 2 in case of an error different from an invalid startup value", async () => {
      mockPostFn.mockImplementation(() => (
        { ok: false, json: mockJsonFn }
      ));
      mockJsonFn.mockResolvedValue("Failed");

      const result = await client.iscsi.login({ id: "1" }, { ...auth, startup: "invalid" });
      expect(result).toEqual(2);
    });
  });

  describe("#logout", () => {
    it("performs an iSCSI logout of the given node", async () => {
      await client.iscsi.logout({ id: "1" });
      expect(mockPostFn).toHaveBeenCalledWith("/storage/iscsi/nodes/1/logout");
    });
  });
});
