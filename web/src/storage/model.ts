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
 * Types that extend the configModel by adding calculated properties and methods.
 */

import { partitionModelMethods } from "~/model/storage";
import type { configModel } from "~/model/storage";

type Model = {
  drives: Drive[];
  mdRaids: MdRaid[];
  volumeGroups: VolumeGroup[];
};

interface Drive extends configModel.Drive {
  getPartition: (path: string) => configModel.Partition | undefined;
  getConfiguredExistingPartitions: () => configModel.Partition[];
}

interface MdRaid extends configModel.MdRaid {
  getPartition: (path: string) => configModel.Partition | undefined;
  getConfiguredExistingPartitions: () => configModel.Partition[];
}

interface VolumeGroup extends Omit<configModel.VolumeGroup, "targetDevices" | "logicalVolumes"> {
  logicalVolumes: LogicalVolume[];
}

type LogicalVolume = configModel.LogicalVolume;

type Formattable = Drive | MdRaid | configModel.Partition | LogicalVolume;

function partitionableProperties(apiDevice: configModel.Drive) {
  const getPartition = (path: string): configModel.Partition | undefined => {
    return apiDevice.partitions.find((p) => p.mountPath === path);
  };

  const getConfiguredExistingPartitions = (): configModel.Partition[] => {
    if (apiDevice.spacePolicy === "custom")
      return apiDevice.partitions.filter(
        (p) =>
          !partitionModelMethods.isNew(p) &&
          (partitionModelMethods.isUsed(p) || partitionModelMethods.isUsedBySpacePolicy(p)),
      );

    return apiDevice.partitions.filter(partitionModelMethods.isReused);
  };

  return {
    getPartition,
    getConfiguredExistingPartitions,
  };
}

function buildDrive(apiDrive: configModel.Drive): Drive {
  return {
    ...apiDrive,
    ...partitionableProperties(apiDrive),
  };
}

function buildMdRaid(apiMdRaid: configModel.MdRaid): MdRaid {
  return {
    ...apiMdRaid,
    ...partitionableProperties(apiMdRaid),
  };
}

function buildLogicalVolume(logicalVolumeData: configModel.LogicalVolume): LogicalVolume {
  return { ...logicalVolumeData };
}

function buildVolumeGroup(apiVolumeGroup: configModel.VolumeGroup): VolumeGroup {
  const buildLogicalVolumes = (): LogicalVolume[] => {
    return (apiVolumeGroup.logicalVolumes || []).map(buildLogicalVolume);
  };

  return {
    ...apiVolumeGroup,
    logicalVolumes: buildLogicalVolumes(),
  };
}

function buildModel(apiModel: configModel.Config): Model {
  const buildDrives = (): Drive[] => {
    return (apiModel.drives || []).map((d) => buildDrive(d));
  };

  const buildMdRaids = (): MdRaid[] => {
    return (apiModel.mdRaids || []).map((r) => buildMdRaid(r));
  };

  const buildVolumeGroups = (): VolumeGroup[] => {
    return (apiModel.volumeGroups || []).map((v) => buildVolumeGroup(v));
  };

  return {
    drives: buildDrives(),
    mdRaids: buildMdRaids(),
    volumeGroups: buildVolumeGroups(),
  };
}

export type { Model, Drive, MdRaid, VolumeGroup, LogicalVolume, Formattable };
export { buildModel };
