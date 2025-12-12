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
import type { ConfigModel } from "~/model/storage/config-model";
import type { Data } from "~/storage";

function movePartitions(
  device: ConfigModel.Drive | ConfigModel.MdRaid,
  volumeGroup: ConfigModel.VolumeGroup,
) {
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

function adjustSpacePolicy(config: ConfigModel.Config, list: string, index: number) {
  const device = findDevice(config, list, index);
  if (device.spacePolicy !== "keep") return;
  if (isUsed(config, list, index)) return;

  device.spacePolicy = null;
}

function adjustSpacePolicies(config: ConfigModel.Config, targets: string[]) {
  ["drives", "mdRaids"].forEach((list) => {
    config[list].forEach((dev, idx) => {
      if (targets.includes(dev.name)) adjustSpacePolicy(config, list, idx);
    });
  });
}

function addVolumeGroup(
  config: ConfigModel.Config,
  data: Data.VolumeGroup,
  moveContent: boolean,
): ConfigModel.Config {
  config = copyApiModel(config);
  adjustSpacePolicies(config, data.targetDevices);

  const volumeGroup = buildVolumeGroup(data);

  if (moveContent) {
    partitionables(config)
      .filter((d) => data.targetDevices.includes(d.name))
      .forEach((d) => movePartitions(d, volumeGroup));
  }

  config.volumeGroups ||= [];
  config.volumeGroups.push(volumeGroup);

  return config;
}

function newVgName(config: ConfigModel.Config): string {
  const vgs = (config.volumeGroups || []).filter((vg) => vg.vgName.match(/^system\d*$/));

  if (!vgs.length) return "system";

  const numbers = vgs.map((vg) => parseInt(vg.vgName.substring(6)) || 0);
  return `system${Math.max(...numbers) + 1}`;
}

function deviceToVolumeGroup(config: ConfigModel.Config, devName: string): ConfigModel.Config {
  config = copyApiModel(config);

  const device = partitionables(config).find((d) => d.name === devName);
  if (!device) return config;

  const volumeGroup = buildVolumeGroup({ vgName: newVgName(config), targetDevices: [devName] });
  movePartitions(device, volumeGroup);
  config.volumeGroups ||= [];
  config.volumeGroups.push(volumeGroup);

  return config;
}

function editVolumeGroup(
  config: ConfigModel.Config,
  vgName: string,
  data: Data.VolumeGroup,
): ConfigModel.Config {
  config = copyApiModel(config);

  const index = (config.volumeGroups || []).findIndex((v) => v.vgName === vgName);
  if (index === -1) return config;

  const oldVolumeGroup = config.volumeGroups[index];
  const newVolumeGroup = { ...oldVolumeGroup, ...buildVolumeGroup(data) };

  adjustSpacePolicies(config, newVolumeGroup.targetDevices);

  config.volumeGroups.splice(index, 1, newVolumeGroup);
  (oldVolumeGroup.targetDevices || []).forEach((d) => {
    config = deleteIfUnused(config, d);
  });

  return config;
}

function volumeGroupToPartitions(config: ConfigModel.Config, vgName: string): ConfigModel.Config {
  config = copyApiModel(config);

  const index = (config.volumeGroups || []).findIndex((v) => v.vgName === vgName);
  if (index === -1) return config;

  const targetDevice = config.volumeGroups[index].targetDevices[0];
  if (!targetDevice) return config;

  const device = partitionables(config).find((d) => d.name === targetDevice);
  if (!device) return config;

  const logicalVolumes = config.volumeGroups[index].logicalVolumes || [];
  config.volumeGroups.splice(index, 1);
  const partitions = device.partitions || [];
  device.partitions = [...partitions, ...logicalVolumes.map(buildPartitionFromLogicalVolume)];

  return config;
}

function deleteVolumeGroup(config: ConfigModel.Config, vgName: string): ConfigModel.Config {
  config = copyApiModel(config);

  const index = (config.volumeGroups || []).findIndex((v) => v.vgName === vgName);
  if (index === -1) return config;

  const targetDevices = config.volumeGroups[index].targetDevices || [];

  config.volumeGroups.splice(index, 1);
  if (!targetDevices.length) return config;

  let deletedApiModel = copyApiModel(config);
  targetDevices.forEach((d) => {
    deletedApiModel = deleteIfUnused(deletedApiModel, d);
  });

  // Do not delete the underlying drives if that results in an empty configuration
  return partitionables(deletedApiModel).length ? deletedApiModel : config;
}

export {
  addVolumeGroup,
  editVolumeGroup,
  deleteVolumeGroup,
  volumeGroupToPartitions,
  deviceToVolumeGroup,
};
