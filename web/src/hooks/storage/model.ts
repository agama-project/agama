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

import { useQuery } from "@tanstack/react-query";
import { configModelQuery } from "~/queries/storage/config-model";
import { apiModel } from "~/api/storage/types";
import { model } from "~/types/storage";

const findDrive = (model: model.Model, name: string): model.Drive | undefined => {
  return model.drives.find((d) => d.name === name);
};

function buildDrive(driveData: apiModel.Drive, model: model.Model): model.Drive {
  const findVolumeGroups = (targetName: string): model.VolumeGroup[] => {
    return model.volumeGroups.filter((v) =>
      v.getTargetDevices().some((d) => d.name === targetName),
    );
  };

  return {
    ...driveData,
    getVolumeGroups: () => findVolumeGroups(driveData.name),
  };
}

function buildLogicalVolume(logicalVolumeData: apiModel.LogicalVolume): model.LogicalVolume {
  return { ...logicalVolumeData };
}

function buildVolumeGroup(
  volumeGroupData: apiModel.VolumeGroup,
  model: model.Model,
): model.VolumeGroup {
  const buildLogicalVolumes = (): model.LogicalVolume[] => {
    return (volumeGroupData.logicalVolumes || []).map(buildLogicalVolume);
  };

  const findTargetDevices = (): model.Drive[] => {
    return (volumeGroupData.targetDevices || []).map((d) => findDrive(model, d)).filter((d) => d);
  };

  return {
    ...volumeGroupData,
    logicalVolumes: buildLogicalVolumes(),
    getTargetDevices: findTargetDevices,
  };
}

function buildModel(modelData: apiModel.Config): model.Model {
  const model: model.Model = {
    drives: [],
    volumeGroups: [],
  };

  const buildDrives = (): model.Drive[] => {
    return (modelData.drives || []).map((d) => buildDrive(d, model));
  };

  const buildVolumeGroups = (): model.VolumeGroup[] => {
    return (modelData.volumeGroups || []).map((v) => buildVolumeGroup(v, model));
  };

  // Important! Modify the model object instead of assigning a new one.
  model.drives = buildDrives();
  model.volumeGroups = buildVolumeGroups();
  return model;
}

function useModel(): model.Model | null {
  const { data } = useQuery(configModelQuery);
  return data ? buildModel(data) : null;
}

function useDrive(name: string): model.Drive | null {
  const model = useModel();
  const drive = model?.drives?.find((d) => d.name === name);
  return drive || null;
}

function useVolumeGroup(vgName: string): model.VolumeGroup | null {
  const model = useModel();
  const volumeGroup = model?.volumeGroups?.find((v) => v.vgName === vgName);
  return volumeGroup || null;
}

export { useModel as default, useDrive, useVolumeGroup };
