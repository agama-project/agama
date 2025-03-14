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
import * as apiModel from "~/api/storage/types/config-model";
import * as model from "~/types/storage/model";

function findDrive(modelData: apiModel.Config, name: string): apiModel.Drive | undefined {
  return modelData.drives.find((d) => d.name === name);
}

function buildDrive(driveData: apiModel.Drive): model.Drive {
  return { ...driveData };
}

function buildLogicalVolume(logicalVolumeData: apiModel.LogicalVolume): model.LogicalVolume {
  return { ...logicalVolumeData };
}

function buildVolumeGroup(
  volumeGroupData: apiModel.VolumeGroup,
  modelData: apiModel.Config,
): model.VolumeGroup {
  const buildTargetDevices = (): model.Drive[] => {
    const names = volumeGroupData.targetDevices || [];
    return names
      .map((n) => findDrive(modelData, n))
      .filter((d) => d)
      .map(buildDrive);
  };

  const buildLogicalVolumes = (): model.LogicalVolume[] => {
    const logicalVolumesData = volumeGroupData.logicalVolumes || [];
    return logicalVolumesData.map(buildLogicalVolume);
  };

  return {
    ...volumeGroupData,
    targetDevices: buildTargetDevices(),
    logicalVolumes: buildLogicalVolumes(),
  };
}

function buildModel(modelData: apiModel.Config): model.Model {
  const buildVolumeGroups = (): model.VolumeGroup[] => {
    const volumeGroupsData = modelData.volumeGroups || [];
    return volumeGroupsData.map((v) => buildVolumeGroup(v, modelData));
  };

  return {
    volumeGroups: buildVolumeGroups(),
  };
}

function useModel(): model.Model | null {
  const { data } = useQuery(configModelQuery);
  return data ? buildModel(data) : null;
}

function useVolumeGroup(vgName: string): model.VolumeGroup | null {
  const model = useModel();
  const volumeGroup = model?.volumeGroups?.find((v) => v.vgName === vgName);
  return volumeGroup || null;
}

export default useModel;

export { useVolumeGroup };
