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

export function isSearchAll(search: config.Search): search is config.SearchAll {
  return search === "*";
}

export function isSearchByName(search: config.Search): search is config.SearchByName {
  return !isSearchAll(search) && typeof search === "string";
}

export function isAdvancedSearch(search: config.Search): search is config.AdvancedSearch {
  return !isSearchAll(search) && !isSearchByName(search);
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

export function isPartition(partition: config.PartitionElement): partition is config.Partition {
  if ("generate" in partition) return false;

  return !isPartitionToDelete(partition) && !isPartitionToDeleteIfNeeded(partition);
}
