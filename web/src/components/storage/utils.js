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
// cspell:ignore xbytes

import xbytes from "xbytes";

import { N_ } from "~/i18n";

/**
 * @typedef {import ("~/client/storage").Volume} Volume
 * @typedef {import ("~/client/storage").StorageDevice} StorageDevice
 * @typedef {import ("~/client/storage").PartitionSlot} PartitionSlot
 */

/**
 * @note undefined for either property means unknown
 * @typedef {object} SizeObject
 * @property {number|undefined} size - The "amount" of size (10, 128, ...)
 * @property {string|undefined} unit - The size unit (MiB, GiB, ...)
 *
 * @typedef {object} SpacePolicy
 * @property {string} id
 * @property {string} label
 * @property {string} description
 * @property {string[]} summaryLabels
 *
 * @typedef {"auto"|"fixed"|"range"} SizeMethod
 */

const SIZE_METHODS = Object.freeze({
  AUTO: "auto",
  MANUAL: "fixed",
  RANGE: "range"
});

const SIZE_UNITS = Object.freeze({
  K: N_("KiB"),
  M: N_("MiB"),
  G: N_("GiB"),
  T: N_("TiB"),
  P: N_("PiB"),
});

const DEFAULT_SIZE_UNIT = "GiB";

/** @type {SpacePolicy[]} */
const SPACE_POLICIES = [
  {
    id: "delete",
    label: N_("Delete current content"),
    description: N_("All partitions will be removed and any data in the disks will be lost."),
    summaryLabels: [
      // TRANSLATORS: This is presented next to the label "Find space", so the whole sentence
      // would read as "Find space deleting all content[...]"
      N_("deleting all content of the installation device"),
      // TRANSLATORS: This is presented next to the label "Find space", so the whole sentence
      // would read as "Find space deleting all content[...]"
      N_("deleting all content of the %d selected disks")
    ]
  },
  {
    id: "resize",
    label: N_("Shrink existing partitions"),
    description: N_("The data is kept, but the current partitions will be resized as needed."),
    summaryLabels: [
      // TRANSLATORS: This is presented next to the label "Find space", so the whole sentence
      // would read as "Find space shrinking partitions[...]"
      N_("shrinking partitions of the installation device"),
      // TRANSLATORS: This is presented next to the label "Find space", so the whole sentence
      // would read as "Find space shrinking partitions[...]"
      N_("shrinking partitions of the %d selected disks")
    ]
  },
  {
    id: "keep",
    label: N_("Use available space"),
    description: N_("The data is kept. Only the space not assigned to any partition will be used."),
    summaryLabels: [
      // TRANSLATORS: This is presented next to the label "Find space", so the whole sentence
      // would read as "Find space without modifying any partition".
      N_("without modifying any partition")
    ]
  },
  {
    id: "custom",
    label: N_("Custom"),
    description: N_("Select what to do with each partition."),
    summaryLabels: [
      // TRANSLATORS: This is presented next to the label "Find space", so the whole sentence
      // would read as "Find space performing a custom set of actions".
      N_("performing a custom set of actions")
    ]
  }
];

/**
 * Convenience method for generating a size object based on given input
 * @function
 *
 * It split given input when a string is given or the result of converting the
 * input otherwise. Note, however, that -1 number will treated as empty string
 * since it means nothing for Agama UI although it represents the "unlimited"
 * size in the backend.
 *
 * @param {number|string|undefined} size
 * @returns {SizeObject}
 */
const splitSize = (size) => {
  // From D-Bus, maxSize comes as undefined when set as "unlimited", but for Agama UI
  // it means "leave it empty"
  const sanitizedSize = size === undefined ? "" : size;
  const parsedSize = typeof sanitizedSize === "string" ? sanitizedSize : xbytes(sanitizedSize, { iec: true });
  const [qty, unit] = parsedSize.split(" ");
  // `Number` will remove trailing zeroes;
  // parseFloat ensures Number does not transform "" into 0.
  const sanitizedQty = Number(parseFloat(qty));

  return {
    unit,
    size: isNaN(sanitizedQty) ? undefined : sanitizedQty
  };
};

/**
 * Generates a disk size representation
 * @function
 *
 * @example
 * deviceSize(1024)
 * // returns "1 KiB"
 *
 * @param {number} size - Number of bytes
 * @returns {string}
 */
const deviceSize = (size) => {
  // Sadly, we cannot returns directly the xbytes(size, { iec: true }) because
  // it does not have an option for dropping/ignoring trailing zeroes and we do
  // not want to render them.
  const result = splitSize(size);
  return `${Number(result.size)} ${result.unit}`;
};

/**
 * Returns the equivalent in bytes resulting from parsing given input
 * @function
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
 *
 * @param {string|number} size
 * @returns {number}
 */
const parseToBytes = (size) => {
  if (!size || size === undefined || size === "") return 0;

  const value = xbytes.parseSize(size.toString(), { iec: true }) || parseInt(size.toString());

  // Avoid decimals resulting from the conversion. D-Bus iface only accepts integer
  return Math.trunc(value);
};

/**
 * Base name of a device.
 * @function
 *
 * @param {StorageDevice} device
 * @returns {string}
 */
const deviceBaseName = (device) => {
  return device.name.split("/").pop();
};

/**
 * Generates the label for the given device
 * @function
 *
 * @param {StorageDevice} device
 * @returns {string}
 */
const deviceLabel = (device) => {
  const name = device.name;
  const size = device.size;

  return size ? `${name}, ${deviceSize(size)}` : name;
};

/**
 * Sorted list of children devices (i.e., partitions and unused slots or logical volumes).
 * @function
 *
 * @note This method could be directly provided by the device object. For now, the method is kept
 * here because the elements considered as children (e.g., partitions + unused slots) is not a
 * semantic storage concept but a helper for UI components.
 *
 * @param {StorageDevice} device
 * @returns {(StorageDevice|PartitionSlot)[]}
 */
const deviceChildren = (device) => {
  const partitionTableChildren = (partitionTable) => {
    const { partitions, unusedSlots } = partitionTable;
    const children = partitions.concat(unusedSlots).filter(i => !!i);
    return children.sort((a, b) => a.start < b.start ? -1 : 1);
  };

  const lvmVgChildren = (lvmVg) => {
    return lvmVg.logicalVolumes.sort((a, b) => a.name < b.name ? -1 : 1);
  };

  if (device.partitionTable) return partitionTableChildren(device.partitionTable);
  if (device.type === "lvmVg") return lvmVgChildren(device);
  return [];
};

/**
 * Checks if volume uses given fs. This method works same as in backend case insensitive.
 * @function
 *
 * @param {Volume} volume
 * @param {string} fs - Filesystem name to check.
 * @returns {boolean} true when volume uses given fs
 */
const hasFS = (volume, fs) => {
  const volFS = volume.fsType;

  return volFS.toLowerCase() === fs.toLocaleLowerCase();
};

/**
 * Checks whether the given volume has snapshots.
 * @function
 *
 * @param {Volume} volume
 * @returns {boolean}
 */
const hasSnapshots = (volume) => {
  return hasFS(volume, "btrfs") && volume.snapshots;
};

/**
 * Checks whether the given volume defines a transactional root.
 * @function
 *
 * @param {Volume} volume
 * @returns {boolean}
 */
const isTransactionalRoot = (volume) => {
  return volume.mountPath === "/" && volume.transactional;
};

/**
 * Checks whether the given volumes defines a transactional system.
 * @function
 *
 * @param {Volume[]} volumes
 * @returns {boolean}
 */
const isTransactionalSystem = (volumes = []) => {
  return volumes.find(v => isTransactionalRoot(v)) !== undefined;
};

export {
  DEFAULT_SIZE_UNIT,
  SIZE_METHODS,
  SIZE_UNITS,
  SPACE_POLICIES,
  deviceBaseName,
  deviceLabel,
  deviceChildren,
  deviceSize,
  parseToBytes,
  splitSize,
  hasFS,
  hasSnapshots,
  isTransactionalRoot,
  isTransactionalSystem
};
