/*
 * Copyright (c) [2024] SUSE LLC
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

import * as config from "./config";

// Type guards.

export function isFormattedDrive(drive: config.DriveElement): drive is config.FormattedDrive {
  return "filesystem" in drive;
}

export function isPartitionedDrive(drive: config.DriveElement): drive is config.PartitionedDrive {
  return !("filesystem" in drive);
}

export function isSimpleSearchAll(search: config.SearchElement): search is config.SimpleSearchAll {
  return search === "*";
}

export function isSimpleSearchByName(
  search: config.SearchElement,
): search is config.SimpleSearchByName {
  return !isSimpleSearchAll(search) && typeof search === "string";
}

export function isAdvancedSearch(search: config.SearchElement): search is config.AdvancedSearch {
  return !isSimpleSearchAll(search) && !isSimpleSearchByName(search);
}

export function isPartitionToDelete(
  partition: config.PartitionElement,
): partition is config.PartitionToDelete {
  return "delete" in partition;
}

export function isPartitionToDeleteIfNeeded(
  partition: config.PartitionElement,
): partition is config.PartitionToDeleteIfNeeded {
  return "deleteIfNeeded" in partition;
}

export function isRegularPartition(
  partition: config.PartitionElement,
): partition is config.RegularPartition {
  if ("generate" in partition) return false;

  return !isPartitionToDelete(partition) && !isPartitionToDeleteIfNeeded(partition);
}

export function isFilesystemTypeAny(
  fstype: config.FilesystemType,
): fstype is config.FilesystemTypeAny {
  return typeof fstype === "string";
}

export function isFilesystemTypeBtrfs(
  fstype: config.FilesystemType,
): fstype is config.FilesystemTypeBtrfs {
  return !isFilesystemTypeAny(fstype) && "btrfs" in fstype;
}

export function isSizeCurrent(size: config.SizeValueWithCurrent): size is config.SizeCurrent {
  return size === "current";
}

export function isSizeBytes(
  size: config.Size | config.SizeValueWithCurrent,
): size is config.SizeBytes {
  return typeof size === "number";
}

export function isSizeString(
  size: config.Size | config.SizeValueWithCurrent,
): size is config.SizeString {
  return typeof size === "string" && size !== "current";
}

export function isSizeValue(size: config.Size): size is config.SizeValue {
  return isSizeBytes(size) || isSizeString(size);
}

export function isSizeTuple(size: config.Size): size is config.SizeTuple {
  return Array.isArray(size);
}

export function isSizeRange(size: config.Size): size is config.SizeRange {
  return !isSizeTuple(size) && typeof size === "object";
}
