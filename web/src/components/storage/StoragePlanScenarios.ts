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

/*
 * TEMPORARY: machines the storage plan playground can be looked at against.
 *
 * The playground reads the real backend, which is the right default and a poor
 * way to see a design: the machine it runs on has the disks it has, and the
 * states worth arguing about (a disk carrying somebody's Windows, a plan spread
 * over three disks and two volume groups) are the ones nobody has to hand.
 *
 * Each scenario here is a machine and a configuration for it, in the shapes the
 * backend serves. What the installer would make of them is worked out in the
 * playground rather than written here, so changing a space policy moves the
 * numbers the way it does against a real backend.
 *
 * NOT meant to be committed, the same as the playground it feeds.
 */

import type { ConfigModel } from "~/model/storage/config-model";
import type { Storage as System } from "~/model/system";

const MiB = 1024 * 1024;
const GiB = 1024 * MiB;

/** Reasons the backend gives, so a device that cannot shrink says why. */
const NO_SHRINK = { supported: false, reasons: ["Resizing is not supported"] };

type PartitionSpec = {
  name: string;
  size: number;
  /** Operating systems found on it, which is what the page names. */
  systems?: string[];
  description?: string;
  filesystem?: { type: System.FilesystemType; mountPath?: string };
  /** The smallest the partition can be made, where shrinking it is possible. */
  minSize?: number;
};

type DiskSpec = {
  name: string;
  size: number;
  model?: string;
  path: string;
  /** Absent where the disk carries no partition table at all. */
  ptable?: System.PartitionTableType;
  partitions?: PartitionSpec[];
};

/**
 * A machine, as the system endpoint describes one.
 *
 * Sids are handed out in order and never reused, since everything downstream,
 * actions included, points at a device by sid.
 */
const machine = (disks: DiskSpec[]): System.Device[] => {
  let sid = 100;
  const devices: System.Device[] = [];

  for (const disk of disks) {
    const used = (disk.partitions || []).reduce((total, part) => total + part.size, 0);
    const partitions: System.Device[] = (disk.partitions || []).map((part) => {
      sid += 1;
      return {
        sid,
        name: part.name,
        description: part.description || "Partition",
        class: "partition",
        block: {
          active: true,
          encrypted: false,
          start: 2048,
          size: part.size,
          systems: part.systems || [],
          shrinking: part.minSize ? { supported: true, minSize: part.minSize } : NO_SHRINK,
        },
        ...(part.filesystem && {
          filesystem: {
            sid: sid + 500,
            type: part.filesystem.type,
            mountPath: part.filesystem.mountPath,
          },
        }),
      };
    });

    sid += 1;
    devices.push({
      sid,
      name: disk.name,
      description: disk.model || "Disk",
      class: "drive",
      drive: { type: "disk", model: disk.model },
      block: {
        active: true,
        encrypted: false,
        start: 0,
        size: disk.size,
        udevPaths: [disk.path],
        systems: [],
        shrinking: NO_SHRINK,
      },
      ...(disk.ptable && {
        partitionTable: {
          type: disk.ptable,
          unusedSlots: disk.size > used ? [{ start: used, size: disk.size - used }] : [],
        },
      }),
      partitions,
    });
  }

  return devices;
};

/** The file system a volume is created with, as the model writes one. */
const fs = (type: ConfigModel.FilesystemType): ConfigModel.Filesystem => ({
  default: false,
  type,
  mountOptions: [],
});

export type ScenarioKey = "one-disk-in-use" | "empty-disk" | "lvm-over-three-disks";

export type Scenario = {
  /** What the switch calls it. */
  label: string;
  /** What the machine holds before the installer touches it. */
  system: System.Device[];
  /** What the installer has been told to do with it. */
  config: ConfigModel.Config;
};

/**
 * One disk, and somebody's data on it.
 *
 * The state the page exists for: what is lost is worth reading before anything
 * else, and the space policy is the decision that changes it. Windows can be
 * shrunk down to 4 GiB, so "resize" and "delete" tell different stories on the
 * same disk.
 */
const oneDiskInUse: Scenario = {
  label: "One disk, in use",
  system: machine([
    {
      name: "/dev/vdd",
      size: 20 * GiB,
      path: "pci-0000:0a:00.0",
      ptable: "gpt",
      partitions: [
        {
          name: "/dev/vdd1",
          size: 18 * GiB,
          systems: ["Windows 11"],
          description: "NTFS Partition",
          filesystem: { type: "ntfs" },
          minSize: 4 * GiB,
        },
        {
          name: "/dev/vdd2",
          size: 1.9 * GiB,
          systems: ["openSUSE Leap 15.2"],
          description: "Ext4 Partition",
          filesystem: { type: "ext4" },
        },
      ],
    },
  ]),
  config: {
    boot: { configure: true, device: { default: true } },
    drives: [
      {
        name: "/dev/vdd",
        spacePolicy: "delete",
        partitions: [
          {
            mountPath: "/",
            filesystem: fs("btrfs"),
            size: { default: true, min: 10 * GiB },
          },
          {
            mountPath: "swap",
            filesystem: fs("swap"),
            size: { default: true, min: 2 * GiB },
          },
        ],
      },
    ],
  },
};

/** One disk with nothing to lose, which is the calm the other states are read against. */
const emptyDisk: Scenario = {
  label: "One disk, empty",
  system: machine([{ name: "/dev/vdc", size: 1024 * GiB, path: "pci-0000:0a:00.1" }]),
  config: {
    boot: { configure: true, device: { default: true } },
    drives: [
      {
        name: "/dev/vdc",
        spacePolicy: "keep",
        partitions: [
          { mountPath: "/", filesystem: fs("btrfs"), size: { default: true, min: 20 * GiB } },
          { mountPath: "/home", filesystem: fs("xfs"), size: { default: true, min: 20 * GiB } },
          { mountPath: "swap", filesystem: fs("swap"), size: { default: true, min: 2 * GiB } },
        ],
      },
    ],
  },
};

/**
 * Three disks, two volume groups, and a partition reused as it is.
 *
 * The plan that made the index worth designing: two groups over disks that also
 * carry partitions of their own, and a third disk formatted whole. Taken from a
 * configuration written against the real backend rather than invented here.
 */
const lvmOverThreeDisks: Scenario = {
  label: "Three disks, two LVM groups",
  system: machine([
    {
      name: "/dev/sda",
      size: 60 * GiB,
      model: "BD-344GS",
      path: "pci-0000:00:1f.2-ata-1",
      ptable: "gpt",
      partitions: [
        {
          name: "/dev/sda1",
          size: 19.99 * GiB,
          systems: ["openSUSE Leap 15.2"],
          description: "Btrfs Partition",
          filesystem: { type: "btrfs" },
        },
        {
          name: "/dev/sda2",
          size: 40 * GiB,
          description: "XFS Partition",
          filesystem: { type: "xfs" },
        },
      ],
    },
    {
      name: "/dev/sdb",
      size: 10 * GiB,
      model: "LakeGate SG321233",
      path: "pci-0000:00:1f.2-ata-2",
      ptable: "gpt",
      partitions: [
        {
          name: "/dev/sdb1",
          size: 10 * GiB,
          systems: ["Windows 11"],
          description: "NTFS Partition",
          filesystem: { type: "ntfs" },
          minSize: 6 * GiB,
        },
      ],
    },
    {
      name: "/dev/sdc",
      size: 80 * GiB,
      model: "LakeGate SG998001",
      path: "pci-0000:00:1f.2-ata-3",
    },
  ]),
  config: {
    boot: { configure: true, device: { default: true } },
    drives: [
      {
        name: "/dev/sda",
        spacePolicy: "delete",
        /* The one partition the plan keeps, formatted for /data rather than
           left as it is: reuse is off in the configuration this comes from. */
        partitions: [{ name: "/dev/sda2", mountPath: "/data", filesystem: fs("xfs") }],
      },
      { name: "/dev/sdb", spacePolicy: "delete", partitions: [] },
      { name: "/dev/sdc", mountPath: "/saca", filesystem: fs("xfs") },
    ],
    volumeGroups: [
      {
        vgName: "system",
        targetDevices: ["/dev/sda"],
        targetDevicesPolicy: "useAvailable",
        logicalVolumes: [
          {
            mountPath: "/",
            filesystem: fs("btrfsSnapshots"),
            size: { default: true, min: 10 * GiB },
          },
          { mountPath: "swap", filesystem: fs("swap"), size: { default: true, min: 1.37 * GiB } },
        ],
      },
      {
        vgName: "another",
        targetDevices: ["/dev/sda", "/dev/sdb"],
        targetDevicesPolicy: "useAvailable",
        logicalVolumes: [
          { mountPath: "/home", filesystem: fs("xfs"), size: { default: true, min: 15 * GiB } },
        ],
      },
    ],
  },
};

export const SCENARIOS: Record<ScenarioKey, Scenario> = {
  "one-disk-in-use": oneDiskInUse,
  "empty-disk": emptyDisk,
  "lvm-over-three-disks": lvmOverThreeDisks,
};

export { GiB, MiB };

/* ------------------------------------------------------------------ *
 * Standing in for the installer
 *
 * What follows works out what a configuration would do to a machine: what is
 * deleted, what is shrunk, what is created, and the actions that say so. It is
 * an approximation and says so out loud. The real solver packs partitions,
 * honours alignment and knows what a file system costs; this one spends free
 * space in the order it is asked for and rounds nothing.
 *
 * It exists so that changing a space policy moves the page, which is the whole
 * point of looking at a scenario. Every number it produces is its own
 * arithmetic, so a scenario is the place to argue about wording and shape, and
 * never about sizes.
 * ------------------------------------------------------------------ */

/** Room the boot loader asks for on the device it is written to. */
const BOOT_SIZE = 8 * MiB;

/** What a volume asks for when the configuration does not say. */
const DEFAULT_VOLUME_SIZE = 10 * GiB;

type Decision =
  | { kind: "keep" }
  | { kind: "delete" }
  | { kind: "shrink"; to: number }
  /** Allowed to go, and not spent: what the reader is told is kept. */
  | { kind: "spare"; allowed: "delete" | "shrink" };

const partitionEntry = (
  device: ConfigModel.Drive | ConfigModel.MdRaid,
  name: string,
): ConfigModel.Partition | undefined => (device.partitions || []).find((p) => p.name === name);

/** The smallest a partition can be made, or its size where it cannot be shrunk. */
const floorOf = (partition: System.Device): number =>
  partition.block?.shrinking?.supported
    ? partition.block.shrinking.minSize || partition.block.size
    : (partition.block?.size ?? 0);

/**
 * What the configuration asks for on one device, before anything is freed.
 *
 * New partitions ask for the size the model gives them; a volume group asks its
 * targets for what its volumes add up to, split evenly between them, which is
 * the crudest reading of "use what is available" and enough to move the page.
 */
const spaceWanted = (
  device: ConfigModel.Drive | ConfigModel.MdRaid,
  config: ConfigModel.Config,
  isBootDevice: boolean,
): number => {
  const created = (device.partitions || [])
    .filter((partition) => !partition.name)
    .reduce((total, partition) => total + (partition.size?.min || DEFAULT_VOLUME_SIZE), 0);

  const groups = (config.volumeGroups || [])
    .filter((group) => (group.targetDevices || []).includes(device.name))
    .reduce((total, group) => {
      const volumes = (group.logicalVolumes || [])
        .filter((lv) => !lv.lvName)
        .reduce((sum, lv) => sum + (lv.size?.min || DEFAULT_VOLUME_SIZE), 0);
      return total + volumes / (group.targetDevices || []).length;
    }, 0);

  return created + groups + (isBootDevice ? BOOT_SIZE : 0);
};

/**
 * What becomes of every partition the device already has.
 *
 * The unconditional decisions are read straight off the configuration. The
 * conditional ones are settled by spending: candidates are taken in the order
 * the device reports them, and once there is room the rest are left alone,
 * which is the state the sheet calls "kept, deleted if room runs short".
 */
const decideExisting = (
  device: ConfigModel.Drive | ConfigModel.MdRaid,
  system: System.Device,
  wanted: number,
): Map<number, Decision> => {
  const policy = device.spacePolicy || "keep";
  const partitions = system.partitions || [];
  const decisions = new Map<number, Decision>();
  const conditional: System.Device[] = [];

  let free = (system.partitionTable?.unusedSlots || []).reduce(
    (total, slot) => total + slot.size,
    0,
  );

  for (const partition of partitions) {
    const entry = partitionEntry(device, partition.name);
    const size = partition.block?.size ?? 0;

    if (entry?.delete || (!entry && policy === "delete")) {
      decisions.set(partition.sid, { kind: "delete" });
      free += size;
      continue;
    }

    if (entry?.mountPath) {
      decisions.set(partition.sid, { kind: "keep" });
      continue;
    }

    if (entry?.deleteIfNeeded || entry?.resizeIfNeeded || entry?.resize) {
      conditional.push(partition);
      continue;
    }

    if (!entry && policy === "resize") {
      conditional.push(partition);
      continue;
    }

    decisions.set(partition.sid, { kind: "keep" });
  }

  for (const partition of conditional) {
    const entry = partitionEntry(device, partition.name);
    const size = partition.block?.size ?? 0;
    const deletes =
      entry?.deleteIfNeeded || (!entry && (device.spacePolicy || "keep") === "delete");

    if (free >= wanted) {
      decisions.set(partition.sid, { kind: "spare", allowed: deletes ? "delete" : "shrink" });
      continue;
    }

    if (deletes) {
      decisions.set(partition.sid, { kind: "delete" });
      free += size;
      continue;
    }

    const floor = floorOf(partition);
    const to = Math.max(floor, size - (wanted - free));
    if (to >= size) {
      decisions.set(partition.sid, { kind: "spare", allowed: "shrink" });
      continue;
    }

    decisions.set(partition.sid, { kind: "shrink", to });
    free += size - to;
  }

  return decisions;
};

type Built = {
  devices: System.Device[];
  actions: { device: number; text: string; delete?: boolean; resize?: boolean }[];
};

/**
 * The machine as the configuration would leave it, and the actions that get it
 * there. See the note at the top of this section: the shapes are right and the
 * arithmetic is this file's own.
 */
export const simulate = (system: System.Device[], config: ConfigModel.Config): Built => {
  let sid = 9000;
  const nextSid = () => (sid += 1);
  const actions: Built["actions"] = [];
  const devices: System.Device[] = [];
  /* Which physical volumes each group ends up with, filled in as the disks
     under it are worked out. */
  const physicalVolumes = new Map<string, number[]>();
  const bootDevice = config.boot?.configure
    ? config.boot.device?.name || (config.drives || [])[0]?.name
    : undefined;

  const entries = [...(config.drives || []), ...(config.mdRaids || [])];

  for (const entry of entries) {
    const source = system.find((device) => device.name === entry.name);
    if (!source) continue;

    const wanted = spaceWanted(entry, config, entry.name === bootDevice);
    const decisions = decideExisting(entry, source, wanted);
    const kept: System.Device[] = [];
    let free = (source.partitionTable?.unusedSlots || []).reduce(
      (total, slot) => total + slot.size,
      0,
    );

    for (const partition of source.partitions || []) {
      const decision = decisions.get(partition.sid) || { kind: "keep" };
      const size = partition.block?.size ?? 0;

      if (decision.kind === "delete") {
        free += size;
        actions.push({
          device: partition.sid,
          text: `Delete partition ${partition.name}`,
          delete: true,
        });
        continue;
      }

      if (decision.kind === "shrink") {
        free += size - decision.to;
        actions.push({
          device: partition.sid,
          text: `Shrink partition ${partition.name}`,
          resize: true,
        });
        kept.push({ ...partition, block: { ...partition.block, size: decision.to } });
        continue;
      }

      /* A partition the new system adopts keeps its device and gets a new file
         system, which is what the result table reads as reformatted. */
      const cfg = partitionEntry(entry, partition.name);
      if (cfg?.mountPath) {
        kept.push({
          ...partition,
          filesystem: {
            sid: nextSid(),
            type: (cfg.filesystem?.type as System.FilesystemType) || "ext4",
            mountPath: cfg.mountPath,
          },
        });
        actions.push({ device: partition.sid, text: `Format partition ${partition.name}` });
        continue;
      }

      kept.push(partition);
    }

    const created: System.Device[] = [];
    let index = (source.partitions || []).length + 1;
    const add = (spec: {
      size: number;
      description: string;
      filesystem?: { type: System.FilesystemType; mountPath?: string };
    }) => {
      const name = `${entry.name}${index}`;
      index += 1;
      const device: System.Device = {
        sid: nextSid(),
        name,
        description: spec.description,
        class: "partition",
        block: {
          active: true,
          encrypted: false,
          start: 0,
          size: spec.size,
          systems: [],
          shrinking: NO_SHRINK,
        },
        ...(spec.filesystem && {
          filesystem: {
            sid: nextSid(),
            type: spec.filesystem.type,
            mountPath: spec.filesystem.mountPath,
          },
        }),
      };
      created.push(device);
      actions.push({ device: device.sid, text: `Create partition ${name}` });
      return device;
    };

    /* The device formatted whole has no partitions to create: what is created
       is the file system on it. */
    if (entry.filesystem) {
      devices.push({
        ...source,
        filesystem: {
          sid: nextSid(),
          type: (entry.filesystem.type as System.FilesystemType) || "ext4",
          mountPath: entry.mountPath,
        },
        partitions: [],
      });
      actions.push({ device: source.sid, text: `Format ${source.name}` });
      continue;
    }

    if (entry.name === bootDevice) {
      add({ size: BOOT_SIZE, description: "BIOS Boot Partition" });
      free -= BOOT_SIZE;
    }

    for (const partition of (entry.partitions || []).filter((one) => !one.name)) {
      const size = Math.min(
        Math.max(partition.size?.min || DEFAULT_VOLUME_SIZE, 0),
        Math.max(free, 0),
      );
      free -= size;
      add({
        size,
        description: `${(partition.filesystem?.type || "ext4").toUpperCase()} Partition`,
        filesystem: {
          type: (partition.filesystem?.type as System.FilesystemType) || "ext4",
          mountPath: partition.mountPath,
        },
      });
    }

    /* Whatever is left goes to the groups this disk feeds, split between them
       in the proportion they asked for. */
    const groups = (config.volumeGroups || []).filter((group) =>
      (group.targetDevices || []).includes(entry.name),
    );
    if (groups.length && free > 0) {
      const shares = groups.map((group) =>
        (group.logicalVolumes || [])
          .filter((lv) => !lv.lvName)
          .reduce((total, lv) => total + (lv.size?.min || DEFAULT_VOLUME_SIZE), 0),
      );
      const asked = shares.reduce((total, share) => total + share, 0) || 1;
      groups.forEach((group, at) => {
        const size = Math.floor((free * shares[at]) / asked);
        if (size <= 0) return;
        const pv = add({ size, description: `PV of ${group.vgName}` });
        physicalVolumes.set(group.vgName, [...(physicalVolumes.get(group.vgName) || []), pv.sid]);
      });
    }

    devices.push({
      ...source,
      partitionTable: source.partitionTable && {
        ...source.partitionTable,
        unusedSlots: free > 0 ? [{ start: 0, size: free }] : [],
      },
      partitions: [...kept, ...created],
    });
  }

  for (const group of config.volumeGroups || []) {
    const pvs = physicalVolumes.get(group.vgName) || [];
    const size = pvs.reduce((total, pvSid) => {
      const pv = devices.flatMap((device) => device.partitions || []).find((p) => p.sid === pvSid);
      return total + (pv?.block?.size ?? 0);
    }, 0);

    const volumes = (group.logicalVolumes || []).filter((lv) => !lv.lvName);
    const asked =
      volumes.reduce((total, lv) => total + (lv.size?.min || DEFAULT_VOLUME_SIZE), 0) || 1;

    const logicalVolumes: System.Device[] = volumes.map((lv) => {
      const share = Math.floor((size * (lv.size?.min || DEFAULT_VOLUME_SIZE)) / asked);
      const name = lv.mountPath === "/" ? "root" : (lv.mountPath || "volume").replace(/^\//, "");
      const device: System.Device = {
        sid: nextSid(),
        name: `/dev/${group.vgName}/${name}`,
        description: `${(lv.filesystem?.type || "ext4").toUpperCase()} LV`,
        class: "logicalVolume",
        block: {
          active: true,
          encrypted: false,
          start: 0,
          size: share,
          systems: [],
          shrinking: NO_SHRINK,
        },
        filesystem: {
          sid: nextSid(),
          type: (lv.filesystem?.type as System.FilesystemType) || "ext4",
          mountPath: lv.mountPath,
        },
      };
      actions.push({ device: device.sid, text: `Create logical volume ${name}` });
      return device;
    });

    const vg: System.Device = {
      sid: nextSid(),
      name: `/dev/${group.vgName}`,
      description: "LVM",
      class: "volumeGroup",
      volumeGroup: { size, physicalVolumes: pvs },
      logicalVolumes,
    };
    actions.push({ device: vg.sid, text: `Create volume group ${group.vgName}` });
    devices.push(vg);
  }

  return { devices, actions };
};
