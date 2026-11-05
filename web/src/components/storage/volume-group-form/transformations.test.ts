/*
 * Copyright (c) [2026] SUSE LLC
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

import { buildPayload, toFormValues, usedVolumeGroupNames } from "./transformations";
import type { ConfigModel } from "~/model/storage/config-model";
import type { Storage as System } from "~/model/system";
import type { FormFields } from "./fields";

const device = (name: string, sid: number): System.Device =>
  ({ sid, class: "drive", name }) as System.Device;

const sda = device("/dev/sda", 1);
const sdb = device("/dev/sdb", 2);
const md0 = device("/dev/md0", 3);

// A drive where a partition is being added (it has a mount path and no name yet)
const driveAddingPartitions = (name: string): ConfigModel.Drive => ({
  name,
  partitions: [{ mountPath: "/home" }],
});

const homeVolumeGroup: ConfigModel.VolumeGroup = {
  vgName: "home",
  targetDevices: ["/dev/sda", "/dev/sdb"],
  logicalVolumes: [],
};

const rootVolumeGroup: ConfigModel.VolumeGroup = {
  vgName: "system",
  targetDevices: ["/dev/sdb"],
  logicalVolumes: [],
};

describe("usedVolumeGroupNames", () => {
  it("returns the names of all the volume groups", () => {
    const config: ConfigModel.Config = { volumeGroups: [homeVolumeGroup, rootVolumeGroup] };
    expect(usedVolumeGroupNames(config)).toEqual(["home", "system"]);
  });

  it("leaves out the volume group being edited", () => {
    const config: ConfigModel.Config = { volumeGroups: [homeVolumeGroup, rootVolumeGroup] };
    expect(usedVolumeGroupNames(config, homeVolumeGroup)).toEqual(["system"]);
  });

  it("returns an empty list when there are no volume groups or no configuration", () => {
    expect(usedVolumeGroupNames({})).toEqual([]);
    expect(usedVolumeGroupNames(null)).toEqual([]);
  });
});

describe("toFormValues", () => {
  describe("when editing a volume group", () => {
    const config: ConfigModel.Config = {
      drives: [{ name: "/dev/sda" }, { name: "/dev/sdb" }],
      volumeGroups: [homeVolumeGroup],
    };

    it("uses its name and its target devices", () => {
      expect(toFormValues(config, homeVolumeGroup, [sda, sdb])).toEqual({
        vgName: "home",
        targetDevices: ["/dev/sda", "/dev/sdb"],
      });
    });

    it("leaves out target devices that are not available", () => {
      expect(toFormValues(config, homeVolumeGroup, [sdb])).toEqual({
        vgName: "home",
        targetDevices: ["/dev/sdb"],
      });
    });

    it("keeps the order of the available devices", () => {
      expect(toFormValues(config, homeVolumeGroup, [sdb, sda]).targetDevices).toEqual([
        "/dev/sdb",
        "/dev/sda",
      ]);
    });
  });

  describe("when creating the first volume group", () => {
    it("proposes the usual name and the devices where partitions are being added", () => {
      const config: ConfigModel.Config = {
        drives: [driveAddingPartitions("/dev/sda"), { name: "/dev/sdb" }],
        mdRaids: [driveAddingPartitions("/dev/md0")],
        volumeGroups: [],
      };

      expect(toFormValues(config, null, [sda, sdb, md0])).toEqual({
        vgName: "system",
        targetDevices: ["/dev/sda", "/dev/md0"],
      });
    });

    it("proposes no device when no partition is being added", () => {
      const config: ConfigModel.Config = { drives: [{ name: "/dev/sda" }], volumeGroups: [] };

      expect(toFormValues(config, null, [sda])).toEqual({
        vgName: "system",
        targetDevices: [],
      });
    });

    it("also does it when the configuration has no volume groups section", () => {
      const config: ConfigModel.Config = { drives: [driveAddingPartitions("/dev/sda")] };

      expect(toFormValues(config, undefined, [sda])).toEqual({
        vgName: "system",
        targetDevices: ["/dev/sda"],
      });
    });

    it("leaves out devices that are not available", () => {
      const config: ConfigModel.Config = {
        drives: [driveAddingPartitions("/dev/sda"), driveAddingPartitions("/dev/sdb")],
        volumeGroups: [],
      };

      expect(toFormValues(config, null, [sdb]).targetDevices).toEqual(["/dev/sdb"]);
    });
  });

  describe("when creating another volume group", () => {
    it("proposes nothing", () => {
      const config: ConfigModel.Config = {
        drives: [driveAddingPartitions("/dev/sda")],
        volumeGroups: [homeVolumeGroup],
      };

      expect(toFormValues(config, null, [sda])).toEqual({});
    });
  });

  it("proposes nothing while the configuration is not loaded", () => {
    expect(toFormValues(null, null, [sda])).toEqual({});
  });
});

describe("buildPayload", () => {
  it("returns the name and the target devices", () => {
    const values: FormFields = {
      vgName: "home",
      targetDevices: ["/dev/sda", "/dev/md0"],
      moveMountPoints: false,
    };

    expect(buildPayload(values)).toEqual({
      vgName: "home",
      targetDevices: ["/dev/sda", "/dev/md0"],
    });
  });
});
