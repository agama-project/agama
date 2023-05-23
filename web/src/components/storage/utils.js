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

// cspell:ignore filesize

import { filesize } from "filesize";

/**
 * Generates a disk size representation
 * @function
 *
 * @example
 * deviceSize(1024)
 * // returns "1 kiB"
 *
 * deviceSize(-1)
 * // returns "Unlimited"
 *
 * @param {number} size - Number of bytes. The value -1 represents an unlimited size.
 * @returns {string}
 */
const deviceSize = (size) => {
  if (size === -1) return "Unlimited";

  return filesize(size, { base: 2 });
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

export { deviceSize, deviceLabel };
