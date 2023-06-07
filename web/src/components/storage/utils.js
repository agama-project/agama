/*
 * Copyright (c) [2023] SUSE LLC
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

// cspell:ignore xbytes

import xbytes from "xbytes";

/**
 * @typedef {Object} SizeObject
 * @property {number} size - The "amount" of size
 * @property {string} unit - The size unit
 */

const SIZE_METHODS = Object.freeze({
  AUTO: "auto",
  MANUAL: "manual",
  RANGE: "range"
});

const SIZE_UNITS = Object.freeze({
  K: "KiB",
  M: "MiB",
  G: "GiB",
  T: "TiB",
  P: "PiB",
});

/**
 * Generates a disk size representation
 * @function
 *
 * @example
 * deviceSize(1024)
 * // returns "1 KiB"
 *
 * deviceSize(-1)
 * // returns "Unlimited"
 *
 * @param {number} size - Number of bytes. The value -1 represents an unlimited size.
 * @returns {string}
 */
const deviceSize = (size) => {
  if (size === -1) return "Unlimited";

  return xbytes(size, { iec: true });
};

/**
 * Generates a size object
 *
 * @param {number|string|undefined} size
 * @returns {SizeObject}
 */
const splitSize = (size) => {
  const validSize = size && size !== -1;
  const [parsedSize, parsedUnit] = xbytes(size, { iec: true }).split(" ");

  return {
    size: validSize ? parsedSize : "",
    unit: validSize ? parsedUnit : "GiB"
  };
};

/**
 * Generates a disk size from parsed input
 * @function
 *
 * @example
 * parseSize(1024)
 * // returns "1024"
 *
 * parseSize("1 KiB")
 * // returns "1024"
 *
 * @param {string|number} size
 * @returns {string}
 */
const parseSize = (size) => {
  const value = xbytes.parseSize(size, { iec: true }) || parseInt(size);
  // TODO: evaluate if we really want to avoid decimal numbers
  return Math.trunc(value);
};

/**
 * Generates the label for the given device
 *
 * @param {import(~/clients/storage).StorageDevice} device
 * @returns {string}
 */
const deviceLabel = (device) => {
  const name = device.name;
  const size = device.size;

  return size ? `${name}, ${deviceSize(size)}` : name;
};

export {
  SIZE_UNITS,
  SIZE_METHODS,
  deviceSize,
  deviceLabel,
  parseSize,
  splitSize,
};
