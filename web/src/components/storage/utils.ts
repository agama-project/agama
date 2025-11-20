/*
 * Copyright (c) [2023-2024] SUSE LLC
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

/**
 * @fixme This file implements utils for the storage components and it also offers several functions
 * to get information from a Volume (e.g., #hasSnapshots, #isTransactionalRoot, etc). It would be
 * better to use another approach to encapsulate the volume information. For example, by creating
 * a Volume class or by providing a kind of interface for volumes.
 */

import xbytes from "xbytes";
import { _, N_ } from "~/i18n";
import { model } from "~/types/storage";
import { Volume } from "~/api/system/storage";
import { system, proposal, apiModel } from "~/api/storage";
import { sprintf } from "sprintf-js";

/**
 * @note undefined for either property means unknown
 */
export type SizeObject = {
  size: number | undefined;
  unit: string | undefined;
};

export type SpacePolicy = {
  id: string;
  label: string;
};

export type SizeMethod = "auto" | "fixed" | "range";

const SIZE_METHODS = Object.freeze({
  AUTO: "auto",
  MANUAL: "fixed",
  RANGE: "range",
});

const SIZE_UNITS = Object.freeze({
  K: N_("KiB"),
  M: N_("MiB"),
  G: N_("GiB"),
  T: N_("TiB"),
  P: N_("PiB"),
});

const FILESYSTEM_NAMES = Object.freeze({
  bcachefs: N_("Bcachefs"),
  bitlocke: N_("BitLocker"),
  btrfs: N_("Btrfs"),
  exfat: N_("ExFAT"),
  ext2: N_("Ext2"),
  ext3: N_("Ext3"),
  ext4: N_("Ext4"),
  f2fs: N_("F2FS"),
  jfs: N_("JFS"),
  nfs: N_("NFS"),
  nilfs2: N_("NILFS2"),
  ntfs: N_("NTFS"),
  reiserfs: N_("ReiserFS"),
  swap: N_("Swap"),
  tmpfs: N_("Tmpfs"),
  vfat: N_("FAT"),
  xfs: N_("XFS"),
});

const DEFAULT_SIZE_UNIT = "GiB";

const SPACE_POLICIES: SpacePolicy[] = [
  {
    id: "delete",
    label: N_("Delete current content"),
  },
  {
    id: "resize",
    label: N_("Shrink existing partitions"),
  },
  {
    id: "keep",
    label: N_("Use available space"),
  },
  {
    id: "custom",
    label: N_("Custom"),
  },
];

/**
 * Returns the equivalent in bytes resulting from parsing given input
 *
 * @example
 * parseToBytes(1024)
 * // returns 1024
 *
 * parseToBytes("1 KiB")
 * // returns 1024
 *
 * parseToBytes("")
 * // returns 0
 */
const parseToBytes = (size: string | number): number => {
  if (!size || size === undefined || size === "") return 0;

  const value =
    xbytes.parseSize(size.toString().toUpperCase(), { iec: true }) || parseInt(size.toString());

  // Avoid decimals resulting from the conversion. D-Bus iface only accepts integer
  return Math.trunc(value);
};

type ExactSizeOptions = Pick<xbytes.MainOpts, "iec" | "prefixIndex">;

/**
 * Converts bytes to an exact size representation.
 *
 * An exact representation means that the same number of bytes is obtained when transforming the
 * size string back to bytes. The feasible bigger size unit is used.
 */
function exactSize(bytes: number, options?: ExactSizeOptions): string {
  options = { iec: true, ...options };

  const size = xbytes(bytes, options);
  const bytesFromSize = parseToBytes(size);

  // The size represents the given amount of bytes.
  if (bytes === bytesFromSize) return size;

  if (options.iec) {
    // Try without IEC unit
    options = { ...options, iec: false };
  } else {
    // Try with smaller unit
    const prefixIndex = xbytes.parseString(size).prefixIndex - 1;
    options = { iec: true, prefixIndex };
  }

  return exactSize(bytes, options);
}

type SizeOptions = { exact: boolean };

/**
 * Convenience method for generating a size object based on given input
 *
 * It split given input when a string is given or the result of converting the
 * input otherwise. Note, however, that -1 number will treated as empty string
 * since it means nothing for Agama UI although it represents the "unlimited"
 * size in the backend.
 */
const splitSize = (size: number | string | undefined, options?: SizeOptions): SizeObject => {
  const strSize = (size) => (options?.exact ? exactSize(size) : xbytes(size, { iec: true }));
  // From D-Bus, maxSize comes as undefined when set as "unlimited", but for Agama UI
  // it means "leave it empty"
  const sanitizedSize = size === undefined ? "" : size;
  const parsedSize = typeof sanitizedSize === "string" ? sanitizedSize : strSize(size);
  const [qty, unit] = parsedSize.split(" ");
  // `Number` will remove trailing zeroes;
  // parseFloat ensures Number does not transform "" into 0.
  const sanitizedQty = Number(parseFloat(qty));

  return {
    unit,
    size: isNaN(sanitizedQty) ? undefined : sanitizedQty,
  };
};

/**
 * Generates a disk size representation
 *
 * @example
 * deviceSize(1024)
 * // returns "1 KiB"
 */
const deviceSize = (size: number, options?: SizeOptions): string => {
  // Sadly, we cannot returns directly the xbytes(size, { iec: true }) because
  // it does not have an option for dropping/ignoring trailing zeroes and we do
  // not want to render them.
  const result = splitSize(size, options);
  return `${Number(result.size)} ${result.unit}`;
};

const TRUNCATE_MAX_LENGTH = 17;

/**
 * Base name for a full path
 *
 * FIXME: The truncate param allows to generate a shorter representation that fits into
 * the interface, but that's a temporary solution. The right way to make the strings fit
 * into the responsive interface would be Patternfly's Truncate component.
 */
const baseName = (name: string, truncate?: boolean): string => {
  const base = name.split("/").pop();

  if (!truncate || base.length <= TRUNCATE_MAX_LENGTH) return base;

  // Simplistic approach as a first implementation. Anyways, we plan to replace this with
  // the usage of Patternfly's Truncate in the mid-term.
  const limit1 = Math.ceil((TRUNCATE_MAX_LENGTH - 1) / 2.0);
  const limit2 = base.length - Math.floor((TRUNCATE_MAX_LENGTH - 1) / 2.0);
  return base.slice(0, limit1) + "…" + base.slice(limit2);
};

type DeviceWithName = system.Device | model.Drive | model.MdRaid;

/**
 * Base name of a device.
 *
 * FIXME: See note at baseName about the usage of truncate.
 */
const deviceBaseName = (device: DeviceWithName, truncate?: boolean): string => {
  return baseName(device.name, truncate);
};

/**
 * Generates the label for the given device
 *
 * FIXME: See note at baseName about the usage of truncate.
 */
const deviceLabel = (device: system.Device, truncate?: boolean): string => {
  const name = deviceBaseName(device, truncate);
  const size = device.block?.size;

  return size ? `${name} (${deviceSize(size)})` : name;
};

type PartitionTableContent = (proposal.Device | proposal.UnusedSlot)[];

function partitionTableContent(device: proposal.Device): PartitionTableContent {
  const partitions: [number, proposal.Device][] =
    device.partitions?.map((p) => [p.block.start, p]) || [];
  const unusedSlots: [number, proposal.UnusedSlot][] = device.partitionTable?.unusedSlots?.map(
    (s) => [s.start, s],
  );
  return [...partitions, ...unusedSlots].sort((a, b) => (a[0] < b[0] ? -1 : 1)).map((i) => i[1]);
}

function volumeGroupContent(device: proposal.Device): proposal.Device[] {
  return device?.logicalVolumes.sort((a, b) => (a.name < b.name ? -1 : 1)) || [];
}

/**
 * Sorted list of children devices (i.e., partitions and unused slots or logical volumes).
 */
const deviceChildren = (device: proposal.Device): PartitionTableContent | proposal.Device[] => {
  if (device.partitionTable) return partitionTableContent(device);
  if (device.logicalVolumes) return volumeGroupContent(device);
  return [];
};

/**
 * Checks if volume uses given fs. This method works same as in backend case insensitive.
 *
 * @param {Volume} volume
 * @param {string} fs - Filesystem name to check.
 * @returns {boolean} true when volume uses given fs
 */
const hasFS = (volume: Volume, fs: string): boolean => {
  const volFS = volume.fsType;

  return volFS.toLowerCase() === fs.toLocaleLowerCase();
};

/**
 * Checks whether the given volume has snapshots.
 */
const hasSnapshots = (volume: Volume): boolean => {
  return hasFS(volume, "btrfs") && volume.snapshots;
};

/**
 * Checks whether the given volume defines a transactional root.
 */
const isTransactionalRoot = (volume: Volume): boolean => {
  return volume.mountPath === "/" && volume.transactional;
};

/**
 * Checks whether the given volumes defines a transactional system.
 */
const isTransactionalSystem = (volumes: Volume[] = []): boolean => {
  return volumes.find((v) => isTransactionalRoot(v)) !== undefined;
};

/**
 * Generates a label for the given volume.
 */
const volumeLabel = (volume: Volume): string =>
  volume.mountPath === "/" ? "root" : volume.mountPath;

/**
 * @see filesystemType
 */
const filesystemLabel = (fstype: string): string => {
  const name = FILESYSTEM_NAMES[fstype];

  // eslint-disable-next-line agama-i18n/string-literals
  if (name) return _(name);

  // Fallback for unknown filesystem types
  return fstype.charAt(0).toUpperCase() + fstype.slice(1);
};

/**
 * String to represent the filesystem type
 *
 * @returns undefined if there is not enough information
 */
const filesystemType = (filesystem: apiModel.Filesystem): string | undefined => {
  if (filesystem.type) {
    if (filesystem.snapshots) return _("Btrfs with snapshots");

    return filesystemLabel(filesystem.type);
  }

  return undefined;
};

/**
 * GiB to Bytes.
 */
const gib: (value: number) => number = (value): number => value * 1024 ** 3;

/**
 * Formats a mount path within a sentence in a i18n-friendly way.
 */
const formattedPath = (path: string): string => {
  // TRANSLATORS: sub-string used to represent a path like "/" or "/var". %s is replaced by the path
  // itself, the rest of the string (quotation marks in the English case) is used to encapsulate the
  // path in a bigger sentence like 'Create partitions for "/" and "/var"'.
  return sprintf(_('"%s"'), path);
};

/**
 * Representation of the given size limits.
 */
const sizeDescription = (size: apiModel.Size): string => {
  const minSize = deviceSize(size.min);
  const maxSize = size.max ? deviceSize(size.max) : undefined;

  // TRANSLATORS: Size range, %1$s is the min size and %2$s is the max
  if (maxSize && minSize !== maxSize) return sprintf(_("%1$s - %2$s"), minSize, maxSize);
  // TRANSLATORS: minimum device size, %s is replaced by size string, e.g. "17.5 GiB"
  if (maxSize === undefined) return sprintf(_("at least %s"), minSize);

  return `${minSize}`;
};

export {
  DEFAULT_SIZE_UNIT,
  SIZE_METHODS,
  SIZE_UNITS,
  SPACE_POLICIES,
  baseName,
  deviceBaseName,
  deviceLabel,
  deviceChildren,
  deviceSize,
  filesystemLabel,
  filesystemType,
  formattedPath,
  gib,
  parseToBytes,
  splitSize,
  sizeDescription,
  hasFS,
  hasSnapshots,
  isTransactionalRoot,
  isTransactionalSystem,
  volumeLabel,
};
