/*
 * Copyright (c) [2026] SUSE LLC
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

import configModel from "./config-model";
import type { ConfigModel } from "./config-model";

describe("configModel", () => {
  describe("clone", () => {
    it("creates a deep copy of the config", () => {
      const original: ConfigModel.Config = {
        boot: { configure: true, bootloader: "grub2" },
        encryption: { password: "secret", tpm: false },
        drives: [{ name: "/dev/sda", partitions: [] }],
      };

      const cloned = configModel.clone(original);

      expect(cloned).toEqual(original);
      expect(cloned).not.toBe(original);
      expect(cloned.drives).not.toBe(original.drives);
    });
  });

  describe("usedMountPaths", () => {
    it("returns mount paths from drives, mdRaids, and volumeGroups", () => {
      const config: ConfigModel.Config = {
        drives: [
          {
            name: "/dev/sda",
            partitions: [{ mountPath: "/" }, { mountPath: "/home" }],
          },
        ],
        mdRaids: [
          {
            name: "/dev/md0",
            partitions: [{ mountPath: "/data" }],
          },
        ],
        volumeGroups: [
          {
            name: "vg0",
            vgName: "vg0",
            targetDevices: [],
            logicalVolumes: [{ mountPath: "/var" }],
          },
        ],
      };

      const paths = configModel.usedMountPaths(config);

      expect(paths).toEqual(["/", "/home", "/data", "/var"]);
    });

    it("returns empty array when no devices are configured", () => {
      const config: ConfigModel.Config = {};

      expect(configModel.usedMountPaths(config)).toEqual([]);
    });
  });

  describe("findMountPathHolder", () => {
    const config: ConfigModel.Config = {
      drives: [
        {
          name: "/dev/sda",
          partitions: [{ mountPath: "/" }, { name: "/dev/sda2", mountPath: "/home" }],
        },
        { name: "/dev/sdb", mountPath: "/srv" },
      ],
      mdRaids: [{ name: "/dev/md0", partitions: [{ mountPath: "/data" }] }],
      volumeGroups: [
        { vgName: "system", targetDevices: [], logicalVolumes: [{ mountPath: "/var" }] },
      ],
    };

    it("finds a new partition, with where it is and its settings", () => {
      expect(configModel.findMountPathHolder(config, "/")).toEqual({
        kind: "newPartition",
        collection: "drives",
        index: 0,
        deviceName: "/dev/sda",
        entry: { mountPath: "/" },
      });
    });

    it("finds a reused partition by its name", () => {
      expect(configModel.findMountPathHolder(config, "/home")).toMatchObject({
        kind: "existingPartition",
        partitionName: "/dev/sda2",
      });
    });

    it("finds a partition on a RAID", () => {
      expect(configModel.findMountPathHolder(config, "/data")).toMatchObject({
        kind: "newPartition",
        collection: "mdRaids",
        deviceName: "/dev/md0",
      });
    });

    it("finds a whole formatted device", () => {
      expect(configModel.findMountPathHolder(config, "/srv")).toEqual({
        kind: "device",
        collection: "drives",
        index: 1,
        deviceName: "/dev/sdb",
      });
    });

    it("finds a logical volume", () => {
      expect(configModel.findMountPathHolder(config, "/var")).toMatchObject({
        kind: "logicalVolume",
        index: 0,
        deviceName: "system",
      });
    });

    it("returns null when nothing holds the mount path", () => {
      expect(configModel.findMountPathHolder(config, "/opt")).toBeNull();
    });
  });

  describe("canReleaseMountPath", () => {
    const config: ConfigModel.Config = {
      drives: [
        { name: "/dev/sda", partitions: [{ mountPath: "/" }] },
        { name: "/dev/sdb", mountPath: "/srv" },
      ],
    };

    it("is true for a partition or a logical volume", () => {
      expect(configModel.canReleaseMountPath(configModel.findMountPathHolder(config, "/"))).toBe(
        true,
      );
    });

    it("is false for a whole formatted device or for nothing", () => {
      expect(configModel.canReleaseMountPath(configModel.findMountPathHolder(config, "/srv"))).toBe(
        false,
      );
      expect(configModel.canReleaseMountPath(null)).toBe(false);
    });
  });

  describe("releaseMountPath", () => {
    const config: ConfigModel.Config = {
      drives: [
        {
          name: "/dev/sda",
          spacePolicy: "delete",
          partitions: [{ mountPath: "/" }, { name: "/dev/sda2", mountPath: "/home" }],
        },
        { name: "/dev/sdb", mountPath: "/srv" },
      ],
      volumeGroups: [
        { vgName: "system", targetDevices: [], logicalVolumes: [{ mountPath: "/var" }] },
      ],
    };

    it("drops a new partition", () => {
      const released = configModel.releaseMountPath(config, "/");
      expect(configModel.usedMountPaths(released)).not.toContain("/");
    });

    it("stops using a reused partition", () => {
      const released = configModel.releaseMountPath(config, "/home");
      expect(released.drives[0].partitions.map((p) => p.mountPath)).toEqual(["/"]);
    });

    it("drops a logical volume", () => {
      const released = configModel.releaseMountPath(config, "/var");
      expect(released.volumeGroups[0].logicalVolumes).toEqual([]);
    });

    it("leaves a whole formatted device as it is", () => {
      expect(configModel.releaseMountPath(config, "/srv")).toEqual(config);
    });

    it("does not change the given config", () => {
      configModel.releaseMountPath(config, "/");
      expect(configModel.usedMountPaths(config)).toContain("/");
    });
  });

  describe("isTargetDevice", () => {
    it("returns true when device is in volumeGroup targetDevices", () => {
      const config: ConfigModel.Config = {
        volumeGroups: [
          {
            name: "vg0",
            vgName: "vg0",
            targetDevices: ["/dev/sda1", "/dev/sdb1"],
          },
        ],
      };

      expect(configModel.isTargetDevice(config, "/dev/sda1")).toBe(true);
      expect(configModel.isTargetDevice(config, "/dev/sdb1")).toBe(true);
    });

    it("returns false when device is not in any targetDevices", () => {
      const config: ConfigModel.Config = {
        volumeGroups: [
          {
            name: "vg0",
            vgName: "vg0",
            targetDevices: ["/dev/sda1"],
          },
        ],
      };

      expect(configModel.isTargetDevice(config, "/dev/sdb1")).toBe(false);
    });

    it("returns false when no volumeGroups exist", () => {
      const config: ConfigModel.Config = {};

      expect(configModel.isTargetDevice(config, "/dev/sda1")).toBe(false);
    });
  });

  describe("setEncryption", () => {
    it("sets encryption on the config", () => {
      const config: ConfigModel.Config = { drives: [{ name: "/dev/sda" }] };
      const encryption: ConfigModel.Encryption = { password: "secret", tpm: false };

      const updated = configModel.setEncryption(config, encryption);

      expect(updated.encryption).toEqual(encryption);
      expect(updated).not.toBe(config);
    });

    it("clears encryption when undefined is passed", () => {
      const config: ConfigModel.Config = {
        drives: [{ name: "/dev/sda" }],
        encryption: { password: "secret", tpm: false },
      };

      const updated = configModel.setEncryption(config, undefined);

      expect(updated.encryption).toBeUndefined();
    });
  });

  describe("devices", () => {
    it("returns all devices from drives, mdRaids, and volumeGroups", () => {
      const config: ConfigModel.Config = {
        drives: [{ name: "/dev/sda" }, { name: "/dev/sdb" }],
        mdRaids: [{ name: "/dev/md0" }],
        volumeGroups: [{ name: "vg0", vgName: "vg0", targetDevices: [] }],
      };

      const allDevices = configModel.devices(config);

      expect(allDevices).toHaveLength(4);
      expect(allDevices.map((d) => d.name)).toEqual(["/dev/sda", "/dev/sdb", "/dev/md0", "vg0"]);
    });

    it("returns empty array when no devices exist", () => {
      const config: ConfigModel.Config = {};

      expect(configModel.devices(config)).toEqual([]);
    });
  });

  describe("findDevice", () => {
    const config: ConfigModel.Config = {
      drives: [{ name: "/dev/sda" }, { name: "/dev/sdb" }],
      mdRaids: [{ name: "/dev/md0" }],
      volumeGroups: [{ name: "vg0", vgName: "vg0", targetDevices: [] }],
    };

    it("finds device in drives collection", () => {
      const device = configModel.findDevice(config, "drives", 0);

      expect(device?.name).toBe("/dev/sda");
    });

    it("finds device in mdRaids collection", () => {
      const device = configModel.findDevice(config, "mdRaids", 0);

      expect(device?.name).toBe("/dev/md0");
    });

    it("finds device in volumeGroups collection", () => {
      const device = configModel.findDevice(config, "volumeGroups", 0);

      expect(device?.name).toBe("vg0");
    });

    it("returns null when index is out of bounds", () => {
      const device = configModel.findDevice(config, "drives", 10);

      expect(device).toBeNull();
    });

    it("returns null when collection is undefined", () => {
      const emptyConfig: ConfigModel.Config = {};
      const device = configModel.findDevice(emptyConfig, "drives", 0);

      expect(device).toBeNull();
    });
  });

  describe("findDeviceByName", () => {
    const config: ConfigModel.Config = {
      drives: [{ name: "/dev/sda" }, { name: "/dev/sdb" }],
      mdRaids: [{ name: "/dev/md0" }],
      volumeGroups: [{ name: "vg0", vgName: "vg0", targetDevices: [] }],
    };

    it("finds device by name in drives", () => {
      const device = configModel.findDeviceByName(config, "/dev/sda");

      expect(device?.name).toBe("/dev/sda");
    });

    it("finds device by name in mdRaids", () => {
      const device = configModel.findDeviceByName(config, "/dev/md0");

      expect(device?.name).toBe("/dev/md0");
    });

    it("finds device by name in volumeGroups", () => {
      const device = configModel.findDeviceByName(config, "vg0");

      expect(device?.name).toBe("vg0");
    });

    it("returns null when device is not found", () => {
      const device = configModel.findDeviceByName(config, "/dev/nonexistent");

      expect(device).toBeNull();
    });
  });

  describe("getBootloader", () => {
    it("returns bootloader type when configured", () => {
      const config: ConfigModel.Config = {
        boot: { configure: true, bootloader: "grub2" },
      };

      expect(configModel.getBootloader(config)).toBe("grub2");
    });

    it("returns null when boot is not configured", () => {
      const config: ConfigModel.Config = {};

      expect(configModel.getBootloader(config)).toBeNull();
    });

    it("returns null when bootloader is not set", () => {
      const config: ConfigModel.Config = {
        boot: { configure: true },
      };

      expect(configModel.getBootloader(config)).toBeNull();
    });
  });

  describe("isGrub2WithTpm", () => {
    it("returns true when bootloader is grub2 and encryption has tpm enabled", () => {
      const config: ConfigModel.Config = {
        boot: { configure: true, bootloader: "grub2" },
        encryption: { password: "secret", tpm: true },
      };

      expect(configModel.isGrub2WithTpm(config)).toBe(true);
    });

    it("returns false when bootloader is grub2 but tpm is disabled", () => {
      const config: ConfigModel.Config = {
        boot: { configure: true, bootloader: "grub2" },
        encryption: { password: "secret", tpm: false },
      };

      expect(configModel.isGrub2WithTpm(config)).toBe(false);
    });

    it("returns false when bootloader is grub2-bls with tpm enabled", () => {
      const config: ConfigModel.Config = {
        boot: { configure: true, bootloader: "grub2-bls" },
        encryption: { password: "secret", tpm: true },
      };

      expect(configModel.isGrub2WithTpm(config)).toBe(false);
    });

    it("returns false when bootloader is systemd-boot with tpm enabled", () => {
      const config: ConfigModel.Config = {
        boot: { configure: true, bootloader: "systemd-boot" },
        encryption: { password: "secret", tpm: true },
      };

      expect(configModel.isGrub2WithTpm(config)).toBe(false);
    });

    it("returns false when bootloader is not configured", () => {
      const config: ConfigModel.Config = {
        encryption: { password: "secret", tpm: true },
      };

      expect(configModel.isGrub2WithTpm(config)).toBe(false);
    });

    it("returns false when encryption is not configured", () => {
      const config: ConfigModel.Config = {
        boot: { configure: true, bootloader: "grub2" },
      };

      expect(configModel.isGrub2WithTpm(config)).toBe(false);
    });

    it("returns false when neither bootloader nor encryption is configured", () => {
      const config: ConfigModel.Config = {};

      expect(configModel.isGrub2WithTpm(config)).toBe(false);
    });
  });
});
