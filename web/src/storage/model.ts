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

import { config } from "~/api/storage/types";

// Type guards.

function isFormattedDrive(drive: config.DriveElement): drive is config.FormattedDrive {
  return "filesystem" in drive;
}

function isSearchAll(search: config.Search): search is config.SearchAll {
  return search === "*";
}

function isSearchByName(search: config.Search): search is config.SearchByName {
  return !isSearchAll(search) && typeof search === "string";
}

function isAdvancedSearch(search: config.Search): search is config.AdvancedSearch {
  return !isSearchAll(search) && !isSearchByName(search);
}

function isPartitionToDelete(
  partition: config.PartitionElement,
): partition is config.PartitionToDelete {
  return "delete" in partition;
}

function isPartitionToDeleteIfNeeded(
  partition: config.PartitionElement,
): partition is config.PartitionToDeleteIfNeeded {
  return "deleteIfNeeded" in partition;
}

function isPartition(partition: config.PartitionElement): partition is config.Partition {
  if ("generate" in partition) return false;

  return !isPartitionToDelete(partition) && !isPartitionToDeleteIfNeeded(partition);
}

// Methods to get especific config data.

// type Partition = type.Partition | type.PartitionToDelete | type.PartitionToDeleteIfNeeded;

function nameFromSearch({ search }: { search: config.Search | undefined }): string | undefined {
  if (!isAdvancedSearch(search) || !search?.condition) return;

  return search.condition.name;
}

export type Drive = {
  name: string;
  alias?: string;
  partitions?: Partition[]
};

export type Partition = {
  name?: string;
  alias?: string;
}

function generatePartition(
  partitionConfig: config.Partition | config.PartitionToDelete | config.PartitionToDeleteIfNeeded
): Partition {
  if (isPartition(partitionConfig))
    return generateRegularPartition(partitionConfig)
}

function generatePartitions(driveConfig: config.DriveElement): Partition[] {
  if (isFormattedDrive(driveConfig)) return [];

  const partitionConfigs = driveConfig.partitions || [];
  partitionConfigs
    .filter((c) => isPartition(c) || isPartitionToDelete(c) || isPartitionToDeleteIfNeeded(c))
    .map((c) => generatePartition(c));
}

function generateDrive(
  driveConfig: config.DriveElement,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _index: number,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _config: config.Config,
): Drive {
  return {
    name: nameFromSearch({ search: driveConfig.search }),
    alias: driveConfig.alias,
    partitions: generatePartitions(driveConfig),
  };
}

export function generateDevices(config: config.Config, solvedConfig: config.Config): Drive[] {
  const driveConfigs = solvedConfig.drives || [];
  return driveConfigs.map((d, i) => generateDrive(d, i, config));
}
