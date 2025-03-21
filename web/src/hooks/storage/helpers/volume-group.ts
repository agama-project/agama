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
import copyApiModel from "~/hooks/storage/helpers/copy-api-model";
import { deleteIfUnused } from "~/hooks/storage/helpers/drive";

function toLogicalVolume(partition: apiModel.Partition) {
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
  vgName: string,
  targetDevices: string[],
  moveContent: boolean,
  index?: number,
): apiModel.Config {
  apiModel = copyApiModel(apiModel);

  const volumeGroup = { vgName, targetDevices };

  if (moveContent) {
    (apiModel.drives || [])
      .filter((d) => targetDevices.includes(d.name))
      .forEach((d) => movePartitions(d, volumeGroup));
  }

  apiModel.volumeGroups ||= [];

  if (index === undefined || index >= apiModel.volumeGroups.length) {
    apiModel.volumeGroups.push(volumeGroup);
  } else {
    apiModel.volumeGroups.splice(index, 1, volumeGroup);
  }

  return apiModel;
}

function editVolumeGroup(
  apiModel: apiModel.Config,
  oldVgName: string,
  vgName: string,
  targetDevices: string[],
): apiModel.Config {
  apiModel = copyApiModel(apiModel);

  const index = (apiModel.volumeGroups || []).findIndex((v) => v.vgName === oldVgName);
  if (index === -1) return apiModel;

  const oldTargetDevices = apiModel.volumeGroups[index].targetDevices || [];

  apiModel = addVolumeGroup(apiModel, vgName, targetDevices, false, index);
  oldTargetDevices.forEach((d) => {
    apiModel = deleteIfUnused(apiModel, d);
  });

  return apiModel;
}

export { addVolumeGroup, editVolumeGroup };
