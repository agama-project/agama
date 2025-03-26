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

const findDrive = (model: model.Model, name: string): model.Drive | undefined => {
  return model.drives.find((d) => d.name === name);
};

function buildDrive(
  apiDrive: apiModel.Drive,
  apiModel: apiModel.Config,
  model: model.Model,
): model.Drive {
  const getMountPaths = (): string[] => {
    const mountPaths = (apiDrive.partitions || []).map((p) => p.mountPath);
    return [apiDrive.mountPath, ...mountPaths].filter((p) => p);
  };

  const getVolumeGroups = (): model.VolumeGroup[] => {
    return model.volumeGroups.filter((v) =>
      v.getTargetDevices().some((d) => d.name === apiDrive.name),
    );
  };

  const isExplicitBoot = (): boolean => {
    return (
      apiModel.boot?.configure &&
      !apiModel.boot.device?.default &&
      apiModel.boot.device?.name === apiDrive.name
    );
  };

  const isTargetDevice = (): boolean => {
    const targetDevices = (apiModel.volumeGroups || []).flatMap((v) => v.targetDevices || []);
    return targetDevices.includes(apiDrive.name);
  };

  const isUsed = (): boolean => {
    return (
      isExplicitBoot() ||
      isTargetDevice() ||
      apiDrive.mountPath !== undefined ||
      apiDrive.partitions?.some((p) => p.mountPath)
    );
  };

  return {
    ...apiDrive,
    isUsed: isUsed(),
    getMountPaths,
    getVolumeGroups,
  };
}

function buildLogicalVolume(logicalVolumeData: apiModel.LogicalVolume): model.LogicalVolume {
  return { ...logicalVolumeData };
}

function buildVolumeGroup(
  apiVolumeGroup: apiModel.VolumeGroup,
  model: model.Model,
): model.VolumeGroup {
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
    return (apiModel.drives || []).map((d) => buildDrive(d, apiModel, model));
  };

  const buildVolumeGroups = (): model.VolumeGroup[] => {
    return (apiModel.volumeGroups || []).map((v) => buildVolumeGroup(v, model));
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
