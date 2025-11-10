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

import { apiModel } from "~/api/storage";
import { model } from "~/types/storage";

function buildBoot(apiModel: apiModel.Config, model: model.Model) {
  const getDevice = (): model.Drive | model.MdRaid | null => {
    const targets = [...model.drives, ...model.mdRaids];
    return targets.find((d) => d.name && d.name === apiModel.boot?.device?.name) || null;
  };

  return {
    configure: apiModel?.boot?.configure || false,
    isDefault: apiModel?.boot?.device?.default || false,
    getDevice,
  };
}

function buildPartition(partitionData: apiModel.Partition): model.Partition {
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

const findTarget = (model: model.Model, name: string): model.Drive | model.MdRaid | undefined => {
  return model.drives.concat(model.mdRaids).find((d) => d.name === name);
};

function partitionableProperties(
  apiDevice: apiModel.Drive,
  apiModel: apiModel.Config,
  model: model.Model,
) {
  const buildPartitions = (): model.Partition[] => {
    return (apiDevice.partitions || []).map(buildPartition);
  };

  const partitions = buildPartitions();

  const getMountPaths = (): string[] => {
    const mountPaths = (apiDevice.partitions || []).map((p) => p.mountPath);
    return [apiDevice.mountPath, ...mountPaths].filter((p) => p);
  };

  const getVolumeGroups = (): model.VolumeGroup[] => {
    return model.volumeGroups.filter((v) =>
      v.getTargetDevices().some((d) => d.name === apiDevice.name),
    );
  };

  const getPartition = (path: string): model.Partition | undefined => {
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
    return isExplicitBoot() || isTargetDevice() || getMountPaths().length > 0;
  };

  const isAddingPartitions = (): boolean => {
    return partitions.some((p) => p.mountPath && p.isNew);
  };

  const isReusingPartitions = (): boolean => {
    return partitions.some((p) => p.isReused);
  };

  const getConfiguredExistingPartitions = (): model.Partition[] => {
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
    getMountPaths,
    getVolumeGroups,
    getPartition,
    getConfiguredExistingPartitions,
  };
}

function buildDrive(
  apiDrive: apiModel.Drive,
  listIndex: number,
  apiModel: apiModel.Config,
  model: model.Model,
): model.Drive {
  const list = "drives";

  return {
    ...apiDrive,
    list,
    listIndex,
    ...partitionableProperties(apiDrive, apiModel, model),
  };
}

function buildMdRaid(
  apiMdRaid: apiModel.MdRaid,
  listIndex: number,
  apiModel: apiModel.Config,
  model: model.Model,
): model.MdRaid {
  const list = "mdRaids";

  return {
    ...apiMdRaid,
    list,
    listIndex,
    ...partitionableProperties(apiMdRaid, apiModel, model),
  };
}

function buildLogicalVolume(logicalVolumeData: apiModel.LogicalVolume): model.LogicalVolume {
  return { ...logicalVolumeData };
}

function buildVolumeGroup(
  apiVolumeGroup: apiModel.VolumeGroup,
  listIndex: number,
  model: model.Model,
): model.VolumeGroup {
  const list = "volumeGroups";

  const getMountPaths = (): string[] => {
    return (apiVolumeGroup.logicalVolumes || []).map((l) => l.mountPath).filter((p) => p);
  };

  const buildLogicalVolumes = (): model.LogicalVolume[] => {
    return (apiVolumeGroup.logicalVolumes || []).map(buildLogicalVolume);
  };

  const getTargetDevices = (): (model.Drive | model.MdRaid)[] => {
    return (apiVolumeGroup.targetDevices || []).map((d) => findTarget(model, d)).filter((d) => d);
  };

  return {
    ...apiVolumeGroup,
    logicalVolumes: buildLogicalVolumes(),
    list,
    listIndex,
    getMountPaths,
    getTargetDevices,
  };
}

function buildModel(apiModel: apiModel.Config): model.Model {
  const defaultBoot: model.Boot = {
    configure: false,
    isDefault: false,
    getDevice: () => null,
  };

  const model: model.Model = {
    boot: defaultBoot,
    drives: [],
    mdRaids: [],
    volumeGroups: [],
    getMountPaths: () => [],
  };

  const buildDrives = (): model.Drive[] => {
    return (apiModel.drives || []).map((d, i) => buildDrive(d, i, apiModel, model));
  };

  const buildMdRaids = (): model.MdRaid[] => {
    return (apiModel.mdRaids || []).map((r, i) => buildMdRaid(r, i, apiModel, model));
  };

  const buildVolumeGroups = (): model.VolumeGroup[] => {
    return (apiModel.volumeGroups || []).map((v, i) => buildVolumeGroup(v, i, model));
  };

  const withMountPaths = (): (model.Drive | model.MdRaid | model.VolumeGroup)[] => {
    return [...model.drives, ...model.mdRaids, ...model.volumeGroups];
  };

  const getMountPaths = (): string[] => {
    return withMountPaths().flatMap((d) => d.getMountPaths());
  };

  // Important! Modify the model object instead of assigning a new one.
  model.boot = buildBoot(apiModel, model);
  model.drives = buildDrives();
  model.mdRaids = buildMdRaids();
  model.volumeGroups = buildVolumeGroups();
  model.getMountPaths = getMountPaths;
  return model;
}

export { buildModel };
