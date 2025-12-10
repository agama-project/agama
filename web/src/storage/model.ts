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

import { partition } from "~/model/storage/config-model";
import { usedMountPaths } from "~/model/storage/config-model/partitionable";
import type { configModel } from "~/model/storage/config-model";

type Model = {
  drives: Drive[];
  mdRaids: MdRaid[];
  volumeGroups: VolumeGroup[];
};

interface Drive extends configModel.Drive {
  isExplicitBoot: boolean;
  isUsed: boolean;
  isAddingPartitions: boolean;
  isReusingPartitions: boolean;
  isTargetDevice: boolean;
  isBoot: boolean;
  getVolumeGroups: () => VolumeGroup[];
  getPartition: (path: string) => configModel.Partition | undefined;
  getConfiguredExistingPartitions: () => configModel.Partition[];
}

interface MdRaid extends configModel.MdRaid {
  isExplicitBoot: boolean;
  isUsed: boolean;
  isAddingPartitions: boolean;
  isReusingPartitions: boolean;
  isTargetDevice: boolean;
  isBoot: boolean;
  getVolumeGroups: () => VolumeGroup[];
  getPartition: (path: string) => configModel.Partition | undefined;
  getConfiguredExistingPartitions: () => configModel.Partition[];
}

interface VolumeGroup extends Omit<configModel.VolumeGroup, "targetDevices" | "logicalVolumes"> {
  logicalVolumes: LogicalVolume[];
  getTargetDevices: () => Drive[];
}

type LogicalVolume = configModel.LogicalVolume;

type Formattable = Drive | MdRaid | configModel.Partition | LogicalVolume;

const findTarget = (model: Model, name: string): Drive | MdRaid | undefined => {
  return model.drives.concat(model.mdRaids).find((d) => d.name === name);
};

function partitionableProperties(
  apiDevice: configModel.Drive,
  apiModel: configModel.Config,
  model: Model,
) {
  const getVolumeGroups = (): VolumeGroup[] => {
    return model.volumeGroups.filter((v) =>
      v.getTargetDevices().some((d) => d.name === apiDevice.name),
    );
  };

  const getPartition = (path: string): configModel.Partition | undefined => {
    return apiDevice.partitions.find((p) => p.mountPath === path);
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
    return apiDevice.partitions.some((p) => p.mountPath && partition.isNew(p));
  };

  const isReusingPartitions = (): boolean => {
    return apiDevice.partitions.some(partition.isReused);
  };

  const getConfiguredExistingPartitions = (): configModel.Partition[] => {
    if (apiDevice.spacePolicy === "custom")
      return apiDevice.partitions.filter(
        (p) => !partition.isNew(p) && (partition.isUsed(p) || partition.isUsedBySpacePolicy(p)),
      );

    return apiDevice.partitions.filter(partition.isReused);
  };

  return {
    isUsed: isUsed(),
    isAddingPartitions: isAddingPartitions(),
    isReusingPartitions: isReusingPartitions(),
    isTargetDevice: isTargetDevice(),
    isBoot: isBoot(),
    isExplicitBoot: isExplicitBoot(),
    getVolumeGroups,
    getPartition,
    getConfiguredExistingPartitions,
  };
}

function buildDrive(
  apiDrive: configModel.Drive,
  apiModel: configModel.Config,
  model: Model,
): Drive {
  return {
    ...apiDrive,
    ...partitionableProperties(apiDrive, apiModel, model),
  };
}

function buildMdRaid(
  apiMdRaid: configModel.MdRaid,
  apiModel: configModel.Config,
  model: Model,
): MdRaid {
  return {
    ...apiMdRaid,
    ...partitionableProperties(apiMdRaid, apiModel, model),
  };
}

function buildLogicalVolume(logicalVolumeData: configModel.LogicalVolume): LogicalVolume {
  return { ...logicalVolumeData };
}

function buildVolumeGroup(apiVolumeGroup: configModel.VolumeGroup, model: Model): VolumeGroup {
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

function buildModel(apiModel: configModel.Config): Model {
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

export type { Model, Drive, MdRaid, VolumeGroup, LogicalVolume, Formattable };
export { buildModel };
