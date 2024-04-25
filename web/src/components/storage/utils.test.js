/*
 * Copyright (c) [2023-2024] SUSE LLC
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

import {
  deviceSize,
  deviceBaseName,
  deviceLabel,
  deviceChildren,
  parseToBytes,
  splitSize,
  hasFS,
  hasSnapshots,
  isTransactionalRoot,
  isTransactionalSystem
} from "./utils";

/**
 * @typedef {import("~/client/storage").StorageDevice} StorageDevice
 * @typedef {import("~/client/storage").Volume} Volume
 */

/** Volume factory.
 * @function
 *
 * @param {object} [properties={}]
 * @returns {Volume}
 */
const volume = (properties = {}) => {
  /** @type {Volume} */
  const testVolume = {
    mountPath: "/test",
    target: "DEFAULT",
    fsType: "Btrfs",
    minSize: 1024,
    maxSize: 2048,
    autoSize: false,
    snapshots: false,
    transactional: false,
    outline: {
      required: false,
      fsTypes: ["Btrfs", "Ext4"],
      supportAutoSize: false,
      snapshotsConfigurable: false,
      snapshotsAffectSizes: false,
      sizeRelevantVolumes: [],
      adjustByRam: false,
      productDefined: false
    }
  };

  return { ...testVolume, ...properties };
};

/** @type {StorageDevice} */
const sda = {
  sid: 59,
  isDrive: true,
  type: "disk",
  vendor: "Micron",
  model: "Micron 1100 SATA",
  driver: [],
  bus: "IDE",
  transport: "",
  dellBOSS: false,
  sdCard: true,
  active: true,
  name: "/dev/sda",
  description: "",
  size: 1024,
  systems : [],
  udevIds: [],
  udevPaths: [],
};

/** @type {StorageDevice} */
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
  isEFI: false
};

/** @type {StorageDevice} */
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

sda.partitionTable = {
  type: "gpt",
  partitions: [sda1, sda2],
  unpartitionedSize: 0,
  unusedSlots: [
    { start: 1, size: 1024 },
    { start: 2345, size: 512 }
  ]
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

lvmVg.logicalVolumes = [lvmLv1];

describe("deviceSize", () => {
  it("returns the size with units", () => {
    const result = deviceSize(1024);
    expect(result).toEqual("1 KiB");
  });
});

describe("deviceBaseName", () => {
  it("returns the base name of the given device", () => {
    const device = { ...sda };
    expect(deviceBaseName(device)).toEqual("sda");

    device.name = "/dev/mapper/dm332";
    expect(deviceBaseName(device)).toEqual("dm332");
  });
});

describe("deviceLabel", () => {
  it("returns the device name and size", () => {
    const result = deviceLabel(sda);
    expect(result).toEqual("/dev/sda, 1 KiB");
  });

  it("returns only the device name if the device has no size", () => {
    const device = { ...sda, size: 0 };
    const result = deviceLabel(device);
    expect(result).toEqual("/dev/sda");
  });
});

describe("deviceChildren", () => {
  /** @type {StorageDevice} */
  let device;

  describe("if the device has partition table", () => {
    beforeEach(() => {
      device = sda;
    });

    it("returns the partitions and unused slots", () => {
      const children = deviceChildren(device);
      expect(children.length).toEqual(4);
      device.partitionTable.partitions.forEach(p => expect(children).toContainEqual(p));
      device.partitionTable.unusedSlots.forEach(s => expect(children).toContainEqual(s));
    });
  });

  describe("if the device is a LVM volume group", () => {
    beforeEach(() => {
      device = lvmVg;
    });

    it("returns the logical volumes", () => {
      const children = deviceChildren(device);
      expect(children.length).toEqual(1);
      device.logicalVolumes.forEach(l => expect(children).toContainEqual(l));
    });
  });

  describe("if the device has neither partition table nor logical volumes", () => {
    beforeEach(() => {
      device = { ...sda, partitionTable: undefined };
    });

    it("returns an empty list", () => {
      const children = deviceChildren(device);
      expect(children.length).toEqual(0);
    });
  });
});

describe("parseToBytes", () => {
  it("returns bytes from given input", () => {
    expect(parseToBytes(1024)).toEqual(1024);
    expect(parseToBytes("1024")).toEqual(1024);
    expect(parseToBytes("1 KiB")).toEqual(1024);
    expect(parseToBytes("2 MiB")).toEqual(2097152);
  });

  it("returns 0 if given input is null, undefined, or empty string", () => {
    expect(parseToBytes(null)).toEqual(0);
    expect(parseToBytes(undefined)).toEqual(0);
    expect(parseToBytes("")).toEqual(0);
  });

  it("does not include decimal part of resulting conversion", () => {
    expect(parseToBytes("1024.32 KiB")).toEqual(1048903); // Not 1048903.68
  });
});

describe("splitSize", () => {
  it("returns a size object with size and unit from given input", () => {
    expect(splitSize("2048 KiB")).toEqual({ size: 2048, unit: "KiB" });
  });

  it("returns a size object with the result of converting the input when no string is given", () => {
    expect(splitSize(1000)).toEqual({ size: 1000, unit: "B" });
    expect(splitSize(1024)).toEqual({ size: 1, unit: "KiB" });
    expect(splitSize(1048576)).toEqual({ size: 1, unit: "MiB" });
  });

  it("returns a size object with unknown unit when a string without unit is given", () => {
    expect(splitSize("30")).toEqual({ size: 30, unit: undefined });
  });

  it("returns an 'empty' size object when undefined is given", () => {
    expect(splitSize(undefined)).toEqual({ size: undefined, unit: undefined });
  });

  it("returns an 'empty' size object when an unexpected string is given", () => {
    expect(splitSize("GiB")).toEqual({ size: undefined, unit: undefined });
  });

  it("returns an 'empty' size object when empty string is given", () => {
    expect(splitSize("")).toEqual({ size: undefined, unit: undefined });
  });
});

describe("hasFS", () => {
  it("returns true if volume has given filesystem", () => {
    expect(hasFS(volume({ fsType: "Btrfs" }), "Btrfs")).toBe(true);
  });

  it("returns true if volume has given filesystem regarding different case", () => {
    expect(hasFS(volume({ fsType: "btrfs" }), "Btrfs")).toBe(true);
  });

  it("returns false if volume has different filesystem", () => {
    expect(hasFS(volume({ fsType: "Btrfs" }), "EXT4")).toBe(false);
  });
});

describe("hasSnapshots", () => {
  it("returns false if the volume has not Btrfs file system", () => {
    expect(hasSnapshots(volume({ fsType: "EXT4", snapshots: true }))).toBe(false);
  });

  it("returns false if the volume has not snapshots enabled", () => {
    expect(hasSnapshots(volume({ fsType: "Btrfs", snapshots: false }))).toBe(false);
  });

  it("returns true if the volume has Btrfs file system and snapshots enabled", () => {
    expect(hasSnapshots(volume({ fsType: "Btrfs", snapshots: true }))).toBe(true);
  });
});

describe("isTransactionalRoot", () => {
  it("returns false if the volume is not root", () => {
    expect(isTransactionalRoot(volume({ mountPath: "/home", transactional: true }))).toBe(false);
  });

  it("returns false if the volume has not transactional enabled", () => {
    expect(isTransactionalRoot(volume({ mountPath: "/", transactional: false }))).toBe(false);
  });

  it("returns true if the volume is root and has transactional enabled", () => {
    expect(isTransactionalRoot(volume({ mountPath: "/", transactional: true }))).toBe(true);
  });
});

describe("isTransactionalSystem", () => {
  it("returns false if volumes does not include a transactional root", () => {
    expect(isTransactionalSystem([])).toBe(false);

    const volumes = [
      volume({ mountPath: "/" }),
      volume({ mountPath: "/home", transactional: true })
    ];
    expect(isTransactionalSystem(volumes)).toBe(false);
  });

  it("returns true if volumes includes a transactional root", () => {
    const volumes = [
      volume({ mountPath: "EXT4" }),
      volume({ mountPath: "/", transactional: true })
    ];
    expect(isTransactionalSystem(volumes)).toBe(true);
  });
});
