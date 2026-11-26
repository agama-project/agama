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

import volumeGroup from "./volume-group";
import type { ConfigModel } from "~/model/storage/config-model";

const config = (logicalVolumes: ConfigModel.LogicalVolume[]): ConfigModel.VolumeGroup => ({
  name: "/dev/system",
  vgName: "system",
  logicalVolumes,
});

describe("filterReusedLogicalVolumes", () => {
  it("returns the logical volumes that are reused", () => {
    const reused: ConfigModel.LogicalVolume = {
      name: "/dev/system/data",
      filesystem: { default: false, reuse: true },
    };
    expect(volumeGroup.filterReusedLogicalVolumes(config([reused]))).toEqual([reused]);
  });

  it("ignores new logical volumes", () => {
    const added: ConfigModel.LogicalVolume = {
      mountPath: "/home",
      filesystem: { default: false, type: "xfs" },
    };
    expect(volumeGroup.filterReusedLogicalVolumes(config([added]))).toEqual([]);
  });

  it.each([
    ["deleted", { delete: true }],
    ["deleted if needed", { deleteIfNeeded: true }],
    ["resized if needed", { resizeIfNeeded: true }],
  ])("ignores logical volumes only configured to be %s", (_, flags) => {
    const lv: ConfigModel.LogicalVolume = { name: "/dev/system/data", ...flags };
    expect(volumeGroup.filterReusedLogicalVolumes(config([lv]))).toEqual([]);
  });

  it("copes with a volume group without logical volumes", () => {
    const vg: ConfigModel.VolumeGroup = { name: "/dev/system", vgName: "system" };
    expect(volumeGroup.filterReusedLogicalVolumes(vg)).toEqual([]);
  });
});
