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

import { isUsed, deleteIfUnused } from "~/storage/search";
import {
  copyApiModel,
  partitionables,
  findDevice,
  buildVolumeGroup,
  buildLogicalVolumeFromPartition,
  buildPartitionFromLogicalVolume,
} from "~/storage/api-model";
import type { model } from "~/api/storage";
import type { data } from "~/storage";

function movePartitions(device: model.Drive | model.MdRaid, volumeGroup: model.VolumeGroup) {
  if (!device.partitions) return;

  const newPartitions = device.partitions.filter((p) => !p.name);
  const reusedPartitions = device.partitions.filter((p) => p.name);
  device.partitions = [...reusedPartitions];
  const logicalVolumes = volumeGroup.logicalVolumes || [];
  volumeGroup.logicalVolumes = [
    ...logicalVolumes,
    ...newPartitions.map(buildLogicalVolumeFromPartition),
  ];
}

function adjustSpacePolicy(apiModel: model.Config, list: string, index: number) {
  const device = findDevice(apiModel, list, index);
  if (device.spacePolicy !== "keep") return;
  if (isUsed(apiModel, list, index)) return;

  device.spacePolicy = null;
}

function adjustSpacePolicies(apiModel: model.Config, targets: string[]) {
  ["drives", "mdRaids"].forEach((list) => {
    apiModel[list].forEach((dev, idx) => {
      if (targets.includes(dev.name)) adjustSpacePolicy(apiModel, list, idx);
    });
  });
}

function addVolumeGroup(
  apiModel: model.Config,
  data: data.VolumeGroup,
  moveContent: boolean,
): model.Config {
  apiModel = copyApiModel(apiModel);
  adjustSpacePolicies(apiModel, data.targetDevices);

  const volumeGroup = buildVolumeGroup(data);

  if (moveContent) {
    partitionables(apiModel)
      .filter((d) => data.targetDevices.includes(d.name))
      .forEach((d) => movePartitions(d, volumeGroup));
  }

  apiModel.volumeGroups ||= [];
  apiModel.volumeGroups.push(volumeGroup);

  return apiModel;
}

function newVgName(apiModel: model.Config): string {
  const vgs = (apiModel.volumeGroups || []).filter((vg) => vg.vgName.match(/^system\d*$/));

  if (!vgs.length) return "system";

  const numbers = vgs.map((vg) => parseInt(vg.vgName.substring(6)) || 0);
  return `system${Math.max(...numbers) + 1}`;
}

function deviceToVolumeGroup(apiModel: model.Config, devName: string): model.Config {
  apiModel = copyApiModel(apiModel);

  const device = partitionables(apiModel).find((d) => d.name === devName);
  if (!device) return apiModel;

  const volumeGroup = buildVolumeGroup({ vgName: newVgName(apiModel), targetDevices: [devName] });
  movePartitions(device, volumeGroup);
  apiModel.volumeGroups ||= [];
  apiModel.volumeGroups.push(volumeGroup);

  return apiModel;
}

function editVolumeGroup(
  apiModel: model.Config,
  vgName: string,
  data: data.VolumeGroup,
): model.Config {
  apiModel = copyApiModel(apiModel);

  const index = (apiModel.volumeGroups || []).findIndex((v) => v.vgName === vgName);
  if (index === -1) return apiModel;

  const oldVolumeGroup = apiModel.volumeGroups[index];
  const newVolumeGroup = { ...oldVolumeGroup, ...buildVolumeGroup(data) };

  adjustSpacePolicies(apiModel, newVolumeGroup.targetDevices);

  apiModel.volumeGroups.splice(index, 1, newVolumeGroup);
  (oldVolumeGroup.targetDevices || []).forEach((d) => {
    apiModel = deleteIfUnused(apiModel, d);
  });

  return apiModel;
}

function volumeGroupToPartitions(apiModel: model.Config, vgName: string): model.Config {
  apiModel = copyApiModel(apiModel);

  const index = (apiModel.volumeGroups || []).findIndex((v) => v.vgName === vgName);
  if (index === -1) return apiModel;

  const targetDevice = apiModel.volumeGroups[index].targetDevices[0];
  if (!targetDevice) return apiModel;

  const device = partitionables(apiModel).find((d) => d.name === targetDevice);
  if (!device) return apiModel;

  const logicalVolumes = apiModel.volumeGroups[index].logicalVolumes || [];
  apiModel.volumeGroups.splice(index, 1);
  const partitions = device.partitions || [];
  device.partitions = [...partitions, ...logicalVolumes.map(buildPartitionFromLogicalVolume)];

  return apiModel;
}

function deleteVolumeGroup(apiModel: model.Config, vgName: string): model.Config {
  apiModel = copyApiModel(apiModel);

  const index = (apiModel.volumeGroups || []).findIndex((v) => v.vgName === vgName);
  if (index === -1) return apiModel;

  const targetDevices = apiModel.volumeGroups[index].targetDevices || [];

  apiModel.volumeGroups.splice(index, 1);
  if (!targetDevices.length) return apiModel;

  let deletedApiModel = copyApiModel(apiModel);
  targetDevices.forEach((d) => {
    deletedApiModel = deleteIfUnused(deletedApiModel, d);
  });

  // Do not delete the underlying drives if that results in an empty configuration
  return partitionables(deletedApiModel).length ? deletedApiModel : apiModel;
}

export {
  addVolumeGroup,
  editVolumeGroup,
  deleteVolumeGroup,
  volumeGroupToPartitions,
  deviceToVolumeGroup,
};
