/*
 * Copyright (c) [2025] SUSE LLC
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

import { sift } from "radashi";
import { partitionModel, volumeGroupModel } from "~/model/storage";
import type { ConfigModel } from "~/model/storage";

type Partitionable = ConfigModel.Drive | ConfigModel.MdRaid;

function usedMountPaths(device: Partitionable): string[] {
  const mountPaths = (device.partitions || []).map((p) => p.mountPath);
  return sift([device.mountPath, ...mountPaths]);
}

function isAddingPartitions(device: Partitionable): boolean {
  return device.partitions.some((p) => p.mountPath && partitionModel.isNew(p));
}

function isReusingPartitions(device: Partitionable): boolean {
  return device.partitions.some(partitionModel.isReused);
}

function findPartition(
  device: Partitionable,
  mountPath: string,
): ConfigModel.Partition | undefined {
  return device.partitions.find((p) => p.mountPath === mountPath);
}

function filterVolumeGroups(
  device: Partitionable,
  config: ConfigModel.Config,
): ConfigModel.VolumeGroup[] {
  const volumeGroups = config.volumeGroups || [];
  return volumeGroups.filter((v) =>
    volumeGroupModel.filterTargetDevices(v, config).some((d) => d.name === device.name),
  );
}

function filterConfiguredExistingPartitions(device: Partitionable): ConfigModel.Partition[] {
  if (device.spacePolicy === "custom")
    return device.partitions.filter(
      (p) =>
        !partitionModel.isNew(p) &&
        (partitionModel.isUsed(p) || partitionModel.isUsedBySpacePolicy(p)),
    );

  return device.partitions.filter(partitionModel.isReused);
}

export {
  usedMountPaths,
  isAddingPartitions,
  isReusingPartitions,
  findPartition,
  filterVolumeGroups,
  filterConfiguredExistingPartitions,
};
