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
import { copyApiModel } from "~/helpers/storage";
import { deleteIfUnused } from "~/helpers/storage/drive";
import { buildVolumeGroup } from "~/helpers/storage/build-api-model";
import { data } from "~/types/storage";

function toLogicalVolume(partition: apiModel.Partition): apiModel.LogicalVolume {
  return { ...partition };
}

function movePartitions(drive: apiModel.Drive, volumeGroup: apiModel.VolumeGroup) {
  if (!drive.partitions) return;

  const newPartitions = drive.partitions.filter((p) => !p.name);
  const reusedPartitions = drive.partitions.filter((p) => p.name);
  drive.partitions = [...reusedPartitions];
  const logicalVolumes = volumeGroup.logicalVolumes || [];
  volumeGroup.logicalVolumes = [...logicalVolumes, ...newPartitions.map(toLogicalVolume)];
}

function addVolumeGroup(
  apiModel: apiModel.Config,
  data: data.VolumeGroup,
  moveContent: boolean,
): apiModel.Config {
  apiModel = copyApiModel(apiModel);

  const volumeGroup = buildVolumeGroup(data);

  if (moveContent) {
    (apiModel.drives || [])
      .filter((d) => data.targetDevices.includes(d.name))
      .forEach((d) => movePartitions(d, volumeGroup));
  }

  apiModel.volumeGroups ||= [];
  apiModel.volumeGroups.push(volumeGroup);

  return apiModel;
}

function editVolumeGroup(
  apiModel: apiModel.Config,
  vgName: string,
  data: data.VolumeGroup,
): apiModel.Config {
  apiModel = copyApiModel(apiModel);

  const index = (apiModel.volumeGroups || []).findIndex((v) => v.vgName === vgName);
  if (index === -1) return apiModel;

  const oldVolumeGroup = apiModel.volumeGroups[index];
  const newVolumeGroup = { ...oldVolumeGroup, ...buildVolumeGroup(data) };

  apiModel.volumeGroups.splice(index, 1, newVolumeGroup);
  (oldVolumeGroup.targetDevices || []).forEach((d) => {
    apiModel = deleteIfUnused(apiModel, d);
  });

  return apiModel;
}

function deleteVolumeGroup(apiModel: apiModel.Config, vgName: string): apiModel.Config {
  apiModel = copyApiModel(apiModel);

  const index = (apiModel.volumeGroups || []).findIndex((v) => v.vgName === vgName);
  if (index === -1) return apiModel;

  const targetDevices = apiModel.volumeGroups[index].targetDevices || [];

  apiModel.volumeGroups.splice(index, 1);
  targetDevices.forEach((d) => {
    apiModel = deleteIfUnused(apiModel, d);
  });

  return apiModel;
}

export { addVolumeGroup, editVolumeGroup, deleteVolumeGroup };
