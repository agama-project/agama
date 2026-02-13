/*
 * Copyright (c) [2023-2025] SUSE LLC
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

import {
  deviceSize,
  deviceBaseName,
  deviceLabel,
  deviceChildren,
  parseToBytes,
  splitSize,
  hasFS,
  hasSnapshots,
} from "./utils";
import type { Storage } from "~/model/system";
import type { Volume } from "~/model/system/storage";

/**
 * Volume factory.
 */
const volume = (properties: object = {}): Volume => {
  const testVolume: Volume = {
    mountPath: "/test",
    mountOptions: [],
    fsType: "btrfs",
    minSize: 1024,
    maxSize: 2048,
    autoSize: false,
    outline: {
      required: false,
      fsTypes: ["btrfs", "ext4"],
      supportAutoSize: false,
      snapshotsAffectSizes: false,
      sizeRelevantVolumes: [],
      adjustByRam: false,
    },
  };

  return { ...testVolume, ...properties };
};

describe("deviceSize", () => {
  it("returns the approx size with units", () => {
    expect(deviceSize(1028)).toEqual("1 KiB");
    expect(deviceSize(5 * 1024 ** 2 - 1024)).toEqual("5 MiB");
    expect(deviceSize(5 * 1024 ** 2 - 1000)).toEqual("5 MiB");
    expect(deviceSize(5 * 1024 ** 2 - 7)).toEqual("5 MiB");
  });

  describe("with exact option", () => {
    it("returns the exact size with units", () => {
      expect(deviceSize(1028, { exact: true })).toEqual("1028 B");
      expect(deviceSize(5 * 1024 ** 2 - 1024, { exact: true })).toEqual("5119 KiB");
      expect(deviceSize(5 * 1024 ** 2 - 1000, { exact: true })).toEqual("5241.88 KB");
      expect(deviceSize(5 * 1024 ** 2 - 7, { exact: true })).toEqual("5242873 B");
    });
  });
});

describe("deviceBaseName", () => {
  it("returns the base name of the given device", () => {
    const disk: Storage.Device = { sid: 1, name: "/dev/sda" };
    expect(deviceBaseName(disk)).toEqual("sda");

    const raid: Storage.Device = { sid: 1, name: "/dev/mapper/dm332" };
    expect(deviceBaseName(raid)).toEqual("dm332");
  });
});

describe("deviceLabel", () => {
  const deviceWithSize = (size: number): Storage.Device => {
    return {
      sid: 1,
      name: "/dev/sda",
      block: { start: 0, size, shrinking: { supported: false } },
    };
  };

  it("returns the device basename and size", () => {
    const result = deviceLabel(deviceWithSize(1024));
    expect(result).toEqual("sda (1 KiB)");
  });

  it("returns only the device basename if the device has no size", () => {
    const result = deviceLabel(deviceWithSize(0));
    expect(result).toEqual("sda");
  });
});

describe("deviceChildren", () => {
  let device: Storage.Device;

  describe("if the device has partition table", () => {
    beforeEach(() => {
      device = {
        sid: 1,
        name: "/dev/sda",
        partitionTable: {
          type: "gpt",
          unusedSlots: [
            { start: 0, size: 1024 },
            { start: 4096, size: 1024 },
          ],
        },
        partitions: [
          {
            sid: 10,
            name: "/dev/sda1",
            block: { start: 10, size: 1024, shrinking: { supported: true } },
          },
          {
            sid: 10,
            name: "/dev/sda2",
            block: { start: 1000, size: 1024, shrinking: { supported: true } },
          },
        ],
      };
    });

    it("returns the partitions and unused slots", () => {
      const children = deviceChildren(device);
      expect(children.length).toEqual(4);
      device.partitions.forEach((p) => expect(children).toContainEqual(p));
      device.partitionTable.unusedSlots.forEach((s) => expect(children).toContainEqual(s));
    });
  });

  describe("if the device is a LVM volume group", () => {
    beforeEach(() => {
      device = {
        sid: 1,
        class: "volumeGroup",
        name: "/dev/vg0",
        logicalVolumes: [{ sid: 10, name: "/dev/vg0/lv1" }],
      };
    });

    it("returns the logical volumes", () => {
      const children = deviceChildren(device);
      expect(children.length).toEqual(1);
      device.logicalVolumes.forEach((l) => expect(children).toContainEqual(l));
    });
  });

  describe("if the device has neither partition table nor logical volumes", () => {
    beforeEach(() => {
      device = { sid: 1, name: "/dev/sda" };
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

  it("always considers a downcase 'b' as bytes (like Y2Storage)", () => {
    expect(parseToBytes("1 KiB")).toEqual(1024);
    expect(parseToBytes("1 Kib")).toEqual(1024);
    expect(parseToBytes("1 kib")).toEqual(1024);
    expect(parseToBytes("1 kIb")).toEqual(1024);
    expect(parseToBytes("1 KIb")).toEqual(1024);
    expect(parseToBytes("1 KIB")).toEqual(1024);
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
    expect(hasSnapshots(volume({ fsType: "EXT4" }))).toBe(false);
  });

  it("returns false if the volume has not snapshots enabled", () => {
    expect(hasSnapshots(volume({ fsType: "Btrfs" }))).toBe(false);
  });

  it("returns true if the volume has Btrfs file system and snapshots enabled", () => {
    expect(hasSnapshots(volume({ fsType: "BtrfsSnapshots" }))).toBe(true);
  });
});
