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

import { usedMountPaths } from "~/model/storage/config-model/partitionable";
import type { configModel as apiModel } from "~/model/storage/config-model";

type Model = {
  drives: Drive[];
  mdRaids: MdRaid[];
  volumeGroups: VolumeGroup[];
};

interface Drive extends Omit<apiModel.Drive, "partitions"> {
  isExplicitBoot: boolean;
  isUsed: boolean;
  isAddingPartitions: boolean;
  isReusingPartitions: boolean;
  isTargetDevice: boolean;
  isBoot: boolean;
  partitions: Partition[];
  getVolumeGroups: () => VolumeGroup[];
  getPartition: (path: string) => Partition | undefined;
  getConfiguredExistingPartitions: () => Partition[];
}

interface MdRaid extends Omit<apiModel.MdRaid, "partitions"> {
  isExplicitBoot: boolean;
  isUsed: boolean;
  isAddingPartitions: boolean;
  isReusingPartitions: boolean;
  isTargetDevice: boolean;
  isBoot: boolean;
  partitions: Partition[];
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
  logicalVolumes: LogicalVolume[];
  getTargetDevices: () => Drive[];
}

type LogicalVolume = apiModel.LogicalVolume;

type Formattable = Drive | MdRaid | Partition | LogicalVolume;

function buildPartition(partitionData: apiModel.Partition): Partition {
  const isNew = (): boolean => {
    return !partitionData.name;
  };

  const isUsed = (): boolean => {
    return partitionData.filesystem !== undefined;
  };

  const isReused = (): boolean => {
    return !isNew() && isUsed();
  };

  const isUsedBySpacePolicy = (): boolean => {
    return partitionData.resizeIfNeeded || partitionData.delete || partitionData.deleteIfNeeded;
  };

  return {
    ...partitionData,
    isNew: isNew(),
    isUsed: isUsed(),
    isReused: isReused(),
    isUsedBySpacePolicy: isUsedBySpacePolicy(),
  };
}

const findTarget = (model: Model, name: string): Drive | MdRaid | undefined => {
  return model.drives.concat(model.mdRaids).find((d) => d.name === name);
};

function partitionableProperties(
  apiDevice: apiModel.Drive,
  apiModel: apiModel.Config,
  model: Model,
) {
  const buildPartitions = (): Partition[] => {
    return (apiDevice.partitions || []).map(buildPartition);
  };

  const partitions = buildPartitions();

  const getVolumeGroups = (): VolumeGroup[] => {
    return model.volumeGroups.filter((v) =>
      v.getTargetDevices().some((d) => d.name === apiDevice.name),
    );
  };

  const getPartition = (path: string): Partition | undefined => {
    return partitions.find((p) => p.mountPath === path);
  };

  const isBoot = (): boolean => {
    return apiModel.boot?.configure && apiModel.boot.device?.name === apiDevice.name;
  };

  const isExplicitBoot = (): boolean => {
    return isBoot() && !apiModel.boot.device?.default;
  };

  const isTargetDevice = (): boolean => {
    const targetDevices = (apiModel.volumeGroups || []).flatMap((v) => v.targetDevices || []);
    return targetDevices.includes(apiDevice.name);
  };

  const isUsed = (): boolean => {
    return isExplicitBoot() || isTargetDevice() || usedMountPaths(apiDevice).length > 0;
  };

  const isAddingPartitions = (): boolean => {
    return partitions.some((p) => p.mountPath && p.isNew);
  };

  const isReusingPartitions = (): boolean => {
    return partitions.some((p) => p.isReused);
  };

  const getConfiguredExistingPartitions = (): Partition[] => {
    if (apiDevice.spacePolicy === "custom")
      return partitions.filter((p) => !p.isNew && (p.isUsed || p.isUsedBySpacePolicy));

    return partitions.filter((p) => p.isReused);
  };

  return {
    isUsed: isUsed(),
    isAddingPartitions: isAddingPartitions(),
    isReusingPartitions: isReusingPartitions(),
    isTargetDevice: isTargetDevice(),
    isBoot: isBoot(),
    isExplicitBoot: isExplicitBoot(),
    partitions,
    getVolumeGroups,
    getPartition,
    getConfiguredExistingPartitions,
  };
}

function buildDrive(apiDrive: apiModel.Drive, apiModel: apiModel.Config, model: Model): Drive {
  return {
    ...apiDrive,
    ...partitionableProperties(apiDrive, apiModel, model),
  };
}

function buildMdRaid(apiMdRaid: apiModel.MdRaid, apiModel: apiModel.Config, model: Model): MdRaid {
  return {
    ...apiMdRaid,
    ...partitionableProperties(apiMdRaid, apiModel, model),
  };
}

function buildLogicalVolume(logicalVolumeData: apiModel.LogicalVolume): LogicalVolume {
  return { ...logicalVolumeData };
}

function buildVolumeGroup(apiVolumeGroup: apiModel.VolumeGroup, model: Model): VolumeGroup {
  const buildLogicalVolumes = (): LogicalVolume[] => {
    return (apiVolumeGroup.logicalVolumes || []).map(buildLogicalVolume);
  };

  const getTargetDevices = (): (Drive | MdRaid)[] => {
    return (apiVolumeGroup.targetDevices || []).map((d) => findTarget(model, d)).filter((d) => d);
  };

  return {
    ...apiVolumeGroup,
    logicalVolumes: buildLogicalVolumes(),
    getTargetDevices,
  };
}

function buildModel(apiModel: apiModel.Config): Model {
  const model: Model = {
    drives: [],
    mdRaids: [],
    volumeGroups: [],
  };

  const buildDrives = (): Drive[] => {
    return (apiModel.drives || []).map((d) => buildDrive(d, apiModel, model));
  };

  const buildMdRaids = (): MdRaid[] => {
    return (apiModel.mdRaids || []).map((r) => buildMdRaid(r, apiModel, model));
  };

  const buildVolumeGroups = (): VolumeGroup[] => {
    return (apiModel.volumeGroups || []).map((v) => buildVolumeGroup(v, model));
  };

  // Important! Modify the model object instead of assigning a new one.
  model.drives = buildDrives();
  model.mdRaids = buildMdRaids();
  model.volumeGroups = buildVolumeGroups();
  return model;
}

export type { Model, Drive, MdRaid, Partition, VolumeGroup, LogicalVolume, Formattable };
export { buildModel };
