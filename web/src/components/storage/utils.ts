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
 * to get information from a Volume (e.g., #hasSnapshots, etc). It would be better to use another
 * approach to encapsulate the volume information. For example, by creating a Volume class or by
 * providing a kind of interface for volumes.
 */

import xbytes from "xbytes";
import { _ } from "~/i18n";
import type { TranslatedString } from "~/i18n";
import { sprintf } from "sprintf-js";
import configModel from "~/model/storage/config-model";
import type { ConfigModel, Partitionable } from "~/model/storage/config-model";
import type { Storage as System } from "~/model/system";
import type { Storage as Proposal } from "~/model/proposal";

/**
 * @note undefined for either property means unknown
 */
export type SizeObject = {
  size: number | undefined;
  unit: string | undefined;
};

export type SizeMethod = "auto" | "fixed" | "range";

const SIZE_METHODS = Object.freeze({
  AUTO: "auto",
  MANUAL: "fixed",
  RANGE: "range",
});

const DEFAULT_SIZE_UNIT = "GiB";

/**
 * Returns the translated label for a partitionable device space policy.
 *
 * @param policy - Space policy identifier
 * @returns Translated policy label
 */
const partitionableSpacePolicyLabel = (policy: ConfigModel.SpacePolicy): TranslatedString => {
  switch (policy) {
    case "delete":
      return _("Delete current content");
    case "resize":
      return _("Shrink existing partitions");
    case "keep":
      return _("Use available space");
    case "custom":
      return _("Custom");
  }
};

/**
 * Returns the translated label for a volume group space policy.
 *
 * @param policy - Space policy identifier
 * @returns Translated policy label
 */
const volumeGroupSpacePolicyLabel = (policy: ConfigModel.SpacePolicy): TranslatedString => {
  switch (policy) {
    case "delete":
      return _("Delete current content");
    case "resize":
      return _("Shrink existing logical volumes");
    case "keep":
      return _("Use available space");
    case "custom":
      return _("Custom");
  }
};

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

type DeviceWithName = System.Device | ConfigModel.Drive | ConfigModel.MdRaid;

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
const deviceLabel = (device: System.Device, truncate?: boolean): string => {
  const name = deviceBaseName(device, truncate);
  const size = device.block?.size || device.volumeGroup?.size;

  return size ? `${name} (${deviceSize(size)})` : name;
};

type PartitionTableContent = (Proposal.Device | Proposal.UnusedSlot)[];

function partitionTableContent(device: Proposal.Device): PartitionTableContent {
  const partitions: [number, Proposal.Device][] =
    device.partitions?.map((p) => [p.block.start, p]) || [];
  const unusedSlots: [number, Proposal.UnusedSlot][] = device.partitionTable?.unusedSlots?.map(
    (s) => [s.start, s],
  );
  return [...partitions, ...unusedSlots].sort((a, b) => (a[0] < b[0] ? -1 : 1)).map((i) => i[1]);
}

function volumeGroupContent(device: Proposal.Device): Proposal.Device[] {
  return device?.logicalVolumes.sort((a, b) => (a.name < b.name ? -1 : 1)) || [];
}

/**
 * Sorted list of children devices (i.e., partitions and unused slots or logical volumes).
 */
const deviceChildren = (device: Proposal.Device): PartitionTableContent | Proposal.Device[] => {
  if (device.partitionTable) return partitionTableContent(device);
  if (device.logicalVolumes) return volumeGroupContent(device);
  return [];
};

/**
 * Checks if volume uses given fs. This method works same as in backend case insensitive.
 */
const hasFS = (volume: System.Volume, fs: string): boolean => {
  const volFS = volume.fsType;

  return volFS.toLowerCase() === fs.toLocaleLowerCase();
};

/**
 * Checks whether the given volume has snapshots.
 */
const hasSnapshots = (volume: System.Volume): boolean => {
  return hasFS(volume, "btrfsSnapshots") || hasFS(volume, "btrfsImmutable");
};

/**
 * Generates a label for the given volume.
 */
const volumeLabel = (volume: System.Volume): string =>
  volume.mountPath === "/" ? "root" : volume.mountPath;

/**
 * Generates a translated label for the given filesystem type.
 *
 * @param fstype - Filesystem type from ConfigModel
 * @returns Translated filesystem label
 * @see filesystemType
 */
const filesystemLabel = (fstype: ConfigModel.FilesystemType): TranslatedString => {
  switch (fstype) {
    case "bcachefs":
      return _("Bcachefs");
    case "btrfs":
      return _("Btrfs");
    case "btrfsImmutable":
      return _("immutable Btrfs");
    case "btrfsSnapshots":
      return _("Btrfs with snapshots");
    case "exfat":
      return _("ExFAT");
    case "ext2":
      return _("Ext2");
    case "ext3":
      return _("Ext3");
    case "ext4":
      return _("Ext4");
    case "f2fs":
      return _("F2FS");
    case "jfs":
      return _("JFS");
    case "nfs":
      return _("NFS");
    case "nilfs2":
      return _("NILFS2");
    case "ntfs":
      return _("NTFS");
    case "reiserfs":
      return _("ReiserFS");
    case "swap":
      return _("Swap");
    case "tmpfs":
      return _("Tmpfs");
    case "vfat":
      return _("FAT");
    case "xfs":
      return _("XFS");
    default: {
      // Fallback for future filesystem types not yet handled
      const fs = fstype as string;
      return (fs.charAt(0).toUpperCase() + fs.slice(1)) as TranslatedString;
    }
  }
};

/**
 * String to represent the filesystem type
 *
 * @returns undefined if there is not enough information
 */
const filesystemType = (filesystem: ConfigModel.Filesystem): string | undefined => {
  if (filesystem.type) {
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
const sizeDescription = (size: ConfigModel.Size): string => {
  const minSize = deviceSize(size.min);
  const maxSize = size.max ? deviceSize(size.max) : undefined;

  // TRANSLATORS: Size range, %1$s is the min size and %2$s is the max
  if (maxSize && minSize !== maxSize) return sprintf(_("%1$s - %2$s"), minSize, maxSize);
  // TRANSLATORS: minimum device size, %s is replaced by size string, e.g. "17.5 GiB"
  if (maxSize === undefined) return sprintf(_("at least %s"), minSize);

  return `${minSize}`;
};

function createPartitionableLocation(
  collection: string,
  index: number | string,
): Partitionable.Location | null {
  if (!configModel.partitionable.isCollectionName(collection) || isNaN(Number(index))) {
    console.log("Invalid location: ", collection, index);
    return null;
  }

  return { collection, index: Number(index) };
}

function findPartitionableDevice(
  config: ConfigModel.Config,
  collection: string,
  index: number | string,
): Partitionable.Device | null {
  if (!configModel.partitionable.isCollectionName(collection)) return null;
  if (isNaN(Number(index))) return null;

  return configModel.partitionable.find(config, collection, Number(index));
}

export {
  DEFAULT_SIZE_UNIT,
  SIZE_METHODS,
  partitionableSpacePolicyLabel,
  volumeGroupSpacePolicyLabel,
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
  volumeLabel,
  createPartitionableLocation,
  findPartitionableDevice,
};
