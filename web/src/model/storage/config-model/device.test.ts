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

import configModel from "~/model/storage/config-model";
import type { ConfigModel } from "~/model/storage/config-model";

describe("setSpacePolicy", () => {
  const actions = [{ deviceName: "/dev/sda2", value: "delete" as const }];

  describe("with a reused partition", () => {
    const config = (): ConfigModel.Config => ({
      drives: [
        {
          name: "/dev/sda",
          spacePolicy: "custom",
          partitions: [
            { name: "/dev/sda1", mountPath: "/boot", size: { default: false, min: 100 } },
            { name: "/dev/sda2", mountPath: "/home", filesystem: { default: false, reuse: true } },
            { mountPath: "/" },
          ],
        },
      ],
    });

    it("drops the reuse and applies the action", () => {
      const result = configModel.device.setSpacePolicy(config(), "drives", 0, {
        type: "custom",
        actions,
        release: "/dev/sda2",
      });

      expect(result.drives[0].spacePolicy).toEqual("custom");
      expect(result.drives[0].partitions).toEqual([
        {
          name: "/dev/sda1",
          mountPath: "/boot",
          delete: false,
          resizeIfNeeded: false,
          deleteIfNeeded: false,
          size: undefined,
        },
        { mountPath: "/" },
        { name: "/dev/sda2", delete: true, resizeIfNeeded: false },
      ]);
    });

    it("drops the reuse and keeps the partition when it has no action", () => {
      const result = configModel.device.setSpacePolicy(config(), "drives", 0, {
        type: "custom",
        actions: [],
        release: "/dev/sda2",
      });

      expect(result.drives[0].partitions.map((p) => p.name)).toEqual(["/dev/sda1", undefined]);
    });

    it("does not touch the entries when nothing is released", () => {
      const result = configModel.device.setSpacePolicy(config(), "drives", 0, {
        type: "custom",
        actions: [],
      });

      expect(result.drives[0].partitions.map((p) => p.mountPath)).toEqual(["/boot", "/home", "/"]);
    });

    it("does not modify the given configuration", () => {
      const original = config();
      configModel.device.setSpacePolicy(original, "drives", 0, {
        type: "custom",
        actions,
        release: "/dev/sda2",
      });

      expect(original).toEqual(config());
    });
  });

  it("drops the reuse of a partition of an MD RAID", () => {
    const config: ConfigModel.Config = {
      mdRaids: [{ name: "/dev/md0", partitions: [{ name: "/dev/md0p1", mountPath: "/home" }] }],
    };

    const result = configModel.device.setSpacePolicy(config, "mdRaids", 0, {
      type: "custom",
      actions: [{ deviceName: "/dev/md0p1", value: "resizeIfNeeded" }],
      release: "/dev/md0p1",
    });

    expect(result.mdRaids[0].partitions).toEqual([
      { name: "/dev/md0p1", delete: false, resizeIfNeeded: true },
    ]);
  });

  it("drops the reuse of a logical volume and applies the action", () => {
    const config: ConfigModel.Config = {
      volumeGroups: [
        {
          vgName: "system",
          logicalVolumes: [
            { name: "/dev/system/home", lvName: "home", mountPath: "/home" },
            { lvName: "root", mountPath: "/" },
          ],
        },
      ],
    };

    const result = configModel.device.setSpacePolicy(config, "volumeGroups", 0, {
      type: "custom",
      actions: [{ deviceName: "/dev/system/home", value: "delete" }],
      release: "/dev/system/home",
    });

    expect(result.volumeGroups[0].logicalVolumes).toEqual([
      { lvName: "root", mountPath: "/" },
      { name: "/dev/system/home", delete: true, resizeIfNeeded: false },
    ]);
  });

  it("keeps the other reused entries", () => {
    const config: ConfigModel.Config = {
      volumeGroups: [
        {
          vgName: "system",
          logicalVolumes: [
            { name: "/dev/system/home", lvName: "home", mountPath: "/home" },
            { name: "/dev/system/data", lvName: "data", mountPath: "/data" },
          ],
        },
      ],
    };

    const result = configModel.device.setSpacePolicy(config, "volumeGroups", 0, {
      type: "custom",
      actions: [],
      release: "/dev/system/home",
    });

    expect(result.volumeGroups[0].logicalVolumes.map((l) => l.mountPath)).toEqual(["/data"]);
  });
});
