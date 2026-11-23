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

import type { ConfigModel, MountPathHolder } from "~/model/storage/config-model";
import type { Storage as System } from "~/model/system";
import { holderBasics, holderExtras, holderTitle, mountPointHolder } from "./mount-point-holder";

const GiB = 1024 ** 3;

type Releasable = Exclude<MountPathHolder, { kind: "device" }>;

const newPartition = (entry: ConfigModel.Partition): Releasable => ({
  kind: "newPartition",
  collection: "drives",
  index: 0,
  deviceName: "/dev/vda",
  entry,
});

const reusedPartition = (entry: ConfigModel.Partition): Releasable => ({
  kind: "existingPartition",
  collection: "drives",
  index: 0,
  deviceName: "/dev/vda",
  partitionName: "/dev/vda2",
  entry,
});

const machinePartition = {
  name: "/dev/vda2",
  block: { size: 20 * GiB },
  filesystem: { type: "btrfs", label: "legacy" },
} as System.Device;

describe("mountPointHolder", () => {
  const config: ConfigModel.Config = {
    drives: [{ name: "/dev/vda", partitions: [{ mountPath: "/home" }] }],
  };

  it("finds what holds a mount point other devices use", () => {
    expect(mountPointHolder(config, ["/home"], "/home")).toMatchObject({ kind: "newPartition" });
  });

  it("finds nothing for a mount point no other device uses", () => {
    // e.g. the partition being edited already has it
    expect(mountPointHolder(config, [], "/home")).toBeNull();
  });

  it("finds nothing when a whole device holds it, since it cannot give it up", () => {
    const withDevice: ConfigModel.Config = { drives: [{ name: "/dev/sdb", mountPath: "/srv" }] };
    expect(mountPointHolder(withDevice, ["/srv"], "/srv")).toBeNull();
  });

  it("finds nothing without a config", () => {
    expect(mountPointHolder(null, ["/home"], "/home")).toBeNull();
  });
});

describe("holderTitle", () => {
  it("names each kind of holder", () => {
    expect(holderTitle("/home", newPartition({}))).toBe(
      "/home is already assigned to a new partition on vda",
    );
    expect(holderTitle("/home", reusedPartition({}))).toBe("/home is already assigned to vda2");
    expect(
      holderTitle("/home", { kind: "logicalVolume", index: 0, deviceName: "system", entry: {} }),
    ).toBe("/home is already assigned to a logical volume in system");
  });
});

describe("holderBasics", () => {
  it("tells the file system and size of a new holder from its settings", () => {
    const holder = newPartition({
      filesystem: { default: false, type: "xfs" },
      size: { default: false, min: 5 * GiB },
    });
    expect(holderBasics(holder)).toBe("Currently set up as XFS, at least 5 GiB");
  });

  it("reads a reused partition that keeps its data from the machine", () => {
    const holder = reusedPartition({ filesystem: { default: false, reuse: true } });
    expect(holderBasics(holder, machinePartition)).toBe("Currently set up as Btrfs, 20 GiB");
  });

  it("says what is left to the installer", () => {
    expect(holderBasics(newPartition({}))).toBe(
      "Currently set up as default, decided by the installer",
    );
  });
});

describe("holderExtras", () => {
  it("is nothing when the holder has no other settings", () => {
    expect(holderExtras(newPartition({ filesystem: { default: true } }))).toBeUndefined();
  });

  it("names each setting the holder has, with its value quoted", () => {
    const holder = newPartition({
      filesystem: {
        default: false,
        label: "home",
        mountOptions: ["noatime", "compress=zstd"],
        mkfsExtraArguments: "-O ^metadata_csum",
      },
    });
    const extras = holderExtras(holder);
    expect(extras).toContain('Label "home"');
    expect(extras).toContain('Mount options "noatime,compress=zstd"');
    expect(extras).toContain('Additional format arguments "-O ^metadata_csum"');
  });

  it("reads the label of a reused partition that keeps its data, and skips format arguments", () => {
    const holder = reusedPartition({
      filesystem: { default: false, reuse: true, label: "ignored", mkfsExtraArguments: "-x" },
    });
    expect(holderExtras(holder, machinePartition)).toBe('Label "legacy"');
  });
});
