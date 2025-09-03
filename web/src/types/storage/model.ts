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

/**
 * Model types.
 *
 * Types that extend the apiModel by adding calculated properties and methods.
 */

import { apiModel } from "~/api/storage/types";

type Model = {
  boot: Boot;
  drives: Drive[];
  mdRaids: MdRaid[];
  volumeGroups: VolumeGroup[];
  getMountPaths: () => string[];
};

interface Boot extends Omit<apiModel.Boot, "device"> {
  isDefault: boolean;
  getDevice: () => Drive | MdRaid | null;
}

/**
 * @fixme Remove list and listIndex from types once the components are adapted to receive a list
 * and an index instead of a device object. See ConfigEditor component.
 */

interface Drive extends Omit<apiModel.Drive, "partitions"> {
  list: string;
  listIndex: number;
  isExplicitBoot: boolean;
  isUsed: boolean;
  isAddingPartitions: boolean;
  isReusingPartitions: boolean;
  isTargetDevice: boolean;
  isBoot: boolean;
  partitions: Partition[];
  getMountPaths: () => string[];
  getVolumeGroups: () => VolumeGroup[];
  getPartition: (path: string) => Partition | undefined;
  getConfiguredExistingPartitions: () => Partition[];
}

interface MdRaid extends Omit<apiModel.MdRaid, "partitions"> {
  list: string;
  listIndex: number;
  isExplicitBoot: boolean;
  isUsed: boolean;
  isAddingPartitions: boolean;
  isReusingPartitions: boolean;
  isTargetDevice: boolean;
  isBoot: boolean;
  partitions: Partition[];
  getMountPaths: () => string[];
  getVolumeGroups: () => VolumeGroup[];
  getPartition: (path: string) => Partition | undefined;
  getConfiguredExistingPartitions: () => Partition[];
}

interface Partition extends apiModel.Partition {
  isNew: boolean;
  isUsed: boolean;
  isReused: boolean;
  isUsedBySpacePolicy: boolean;
}

interface VolumeGroup extends Omit<apiModel.VolumeGroup, "targetDevices" | "logicalVolumes"> {
  list: string;
  listIndex: number;
  logicalVolumes: LogicalVolume[];
  getTargetDevices: () => Drive[];
  getMountPaths: () => string[];
}

type LogicalVolume = apiModel.LogicalVolume;

type Formattable = Drive | MdRaid | Partition | LogicalVolume;

export type { Model, Boot, Drive, MdRaid, Partition, VolumeGroup, LogicalVolume, Formattable };
