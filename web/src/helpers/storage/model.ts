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

import { apiModel } from "~/api/storage/types";
import { model } from "~/types/storage";

function buildPartition(partitionData: apiModel.Partition): model.Partition {
  return { ...partitionData };
}

const findDrive = (model: model.Model, name: string): model.Drive | undefined => {
  return model.drives.find((d) => d.name === name);
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

  const isExplicitBoot = (): boolean => {
    return (
      apiModel.boot?.configure &&
      !apiModel.boot.device?.default &&
      apiModel.boot.device?.name === apiDevice.name
    );
  };

  const isTargetDevice = (): boolean => {
    const targetDevices = (apiModel.volumeGroups || []).flatMap((v) => v.targetDevices || []);
    return targetDevices.includes(apiDevice.name);
  };

  const isUsed = (): boolean => {
    return (
      isExplicitBoot() ||
      isTargetDevice() ||
      apiDevice.mountPath !== undefined ||
      apiDevice.partitions?.some((p) => p.mountPath)
    );
  };

  const isAddingPartitions = (): boolean => {
    return (apiDevice.partitions || []).some((p) => p.mountPath && !p.name);
  };

  return {
    isUsed: isUsed(),
    isAddingPartitions: isAddingPartitions(),
    partitions,
    getMountPaths,
    getVolumeGroups,
    getPartition,
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
    ...partitionableProperties(apiDrive, listIndex, apiModel, model),
  };
}

function buildLogicalVolume(logicalVolumeData: apiModel.LogicalVolume): model.LogicalVolume {
  return { ...logicalVolumeData };
}

function buildVolumeGroup(
  apiVolumeGroup: apiModel.VolumeGroup,
  listIndex,
  model: model.Model,
): model.VolumeGroup {
  const list = "volumeGroups";

  const getMountPaths = (): string[] => {
    return (apiVolumeGroup.logicalVolumes || []).map((l) => l.mountPath).filter((p) => p);
  };

  const buildLogicalVolumes = (): model.LogicalVolume[] => {
    return (apiVolumeGroup.logicalVolumes || []).map(buildLogicalVolume);
  };

  const getTargetDevices = (): model.Drive[] => {
    return (apiVolumeGroup.targetDevices || []).map((d) => findDrive(model, d)).filter((d) => d);
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
  const model: model.Model = {
    drives: [],
    volumeGroups: [],
    getMountPaths: () => [],
  };

  const buildDrives = (): model.Drive[] => {
    return (apiModel.drives || []).map((d, i) => buildDrive(d, i, apiModel, model));
  };

  const buildVolumeGroups = (): model.VolumeGroup[] => {
    return (apiModel.volumeGroups || []).map((v, i) => buildVolumeGroup(v, i, model));
  };

  const getMountPaths = (): string[] => {
    return [...model.drives, ...model.volumeGroups].flatMap((d) => d.getMountPaths());
  };

  // Important! Modify the model object instead of assigning a new one.
  model.drives = buildDrives();
  model.volumeGroups = buildVolumeGroups();
  model.getMountPaths = getMountPaths;
  return model;
}

export { buildModel };
