/*
 * Copyright (c) [2025-2026] SUSE LLC
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

import { sift } from "radashi";
import configModel from "~/model/storage/config-model";
import type { ConfigModel, Data } from "~/model/storage/config-model";

function adjustSpacePolicies(config: ConfigModel.Config, targets: string[]) {
  const devices = configModel.partitionable.all(config);
  devices
    .filter((d) => targets.includes(d.name))
    .filter((d) => d.spacePolicy === "keep")
    .filter((d) => !configModel.partitionable.isUsed(config, d.name))
    .forEach((d) => (d.spacePolicy = null));
}

function create(data: Data.VolumeGroup): ConfigModel.VolumeGroup {
  const defaultVolumeGroup = { vgName: "system", targetDevices: [] };
  return { ...defaultVolumeGroup, ...data };
}

function usedMountPaths(volumeGroup: ConfigModel.VolumeGroup): string[] {
  const mountPaths = (volumeGroup.logicalVolumes || []).map((l) => l.mountPath);
  return sift(mountPaths);
}

function find(config: ConfigModel.Config, index: number): ConfigModel.VolumeGroup | null {
  return config.volumeGroups?.[index] ?? null;
}

function findIndex(config: ConfigModel.Config, vgName: string): number {
  return (config.volumeGroups || []).findIndex((v) => v.vgName === vgName);
}

function findByName(config: ConfigModel.Config, vgName: string): ConfigModel.VolumeGroup | null {
  return (config.volumeGroups || []).find((v) => v.vgName === vgName);
}

function candidateTargetDevices(
  config: ConfigModel.Config,
): (ConfigModel.Drive | ConfigModel.MdRaid)[] {
  const drives = config.drives || [];
  const mdRaids = config.mdRaids || [];
  return [...drives, ...mdRaids];
}

function filterTargetDevices(
  config: ConfigModel.Config,
  volumeGroup: ConfigModel.VolumeGroup,
): (ConfigModel.Drive | ConfigModel.MdRaid)[] {
  return candidateTargetDevices(config).filter((d) => volumeGroup.targetDevices.includes(d.name));
}

function add(
  config: ConfigModel.Config,
  data: Data.VolumeGroup,
  moveContent: boolean,
): ConfigModel.Config {
  config = configModel.clone(config);
  adjustSpacePolicies(config, data.targetDevices || []);

  const volumeGroup = create(data);

  if (moveContent) {
    configModel.partitionable
      .all(config)
      .filter((d) => data.targetDevices.includes(d.name))
      .forEach((d) => configModel.partitionable.convertPartitionsToLogicalVolumes(d, volumeGroup));
  }

  config.volumeGroups ||= [];
  config.volumeGroups.push(volumeGroup);

  return config;
}

function edit(
  config: ConfigModel.Config,
  vgName: string,
  data: Data.VolumeGroup,
): ConfigModel.Config {
  config = configModel.clone(config);

  const index = (config.volumeGroups || []).findIndex((v) => v.vgName === vgName);
  if (index === -1) return config;

  const oldVolumeGroup = config.volumeGroups[index];
  const newVolumeGroup = { ...oldVolumeGroup, ...create(data) };

  adjustSpacePolicies(config, newVolumeGroup.targetDevices);

  config.volumeGroups.splice(index, 1, newVolumeGroup);
  (oldVolumeGroup.targetDevices || []).forEach((d) => {
    config = configModel.partitionable.removeIfUnused(config, d);
  });

  return config;
}

function remove(config: ConfigModel.Config, vgName: string): ConfigModel.Config {
  config = configModel.clone(config);

  const index = (config.volumeGroups || []).findIndex((v) => v.vgName === vgName);
  if (index === -1) return config;

  const targetDevices = config.volumeGroups[index].targetDevices || [];

  config.volumeGroups.splice(index, 1);
  if (!targetDevices.length) return config;

  let deletedConfig = configModel.clone(config);
  targetDevices.forEach((d) => {
    deletedConfig = configModel.partitionable.removeIfUnused(deletedConfig, d);
  });

  // Do not delete the underlying drives if that results in an empty configuration
  return configModel.partitionable.all(deletedConfig).length ? deletedConfig : config;
}

function generateName(config: ConfigModel.Config): string {
  const vgs = (config.volumeGroups || []).filter((vg) => vg.vgName.match(/^system\d*$/));

  if (!vgs.length) return "system";

  const numbers = vgs.map((vg) => parseInt(vg.vgName.substring(6)) || 0);
  return `system${Math.max(...numbers) + 1}`;
}

function convertToPartitionable(
  config: ConfigModel.Config,
  vgName: string,
  targetName?: string,
  targetCollection?: "drives" | "mdRaids",
): ConfigModel.Config {
  config = configModel.clone(config);

  const index = (config.volumeGroups || []).findIndex((v) => v.vgName === vgName);
  if (index === -1) return config;

  const targetDevice = targetName || config.volumeGroups[index].targetDevices[0];
  if (!targetDevice) return config;

  let targetDeviceConfig = configModel.partitionable
    .all(config)
    .find((d) => d.name === targetDevice);

  if (!targetDeviceConfig) {
    targetDeviceConfig ||= { name: targetName };
    config[targetCollection || "drives"].push(targetDeviceConfig);
  }

  const logicalVolumes = config.volumeGroups[index].logicalVolumes || [];

  config.volumeGroups.splice(index, 1);

  const partitions = targetDeviceConfig.partitions || [];
  targetDeviceConfig.partitions = [
    ...partitions,
    ...logicalVolumes
      .filter(configModel.volume.isUsed)
      .filter((l) => !configModel.volume.isReused(l))
      .map(configModel.logicalVolume.convertToPartition),
  ];

  return config;
}

function convertToDrive(
  config: ConfigModel.Config,
  vgName: string,
  targetName: string,
): ConfigModel.Config {
  return convertToPartitionable(config, vgName, targetName, "drives");
}

function convertToMdRaid(
  config: ConfigModel.Config,
  vgName: string,
  targetName: string,
): ConfigModel.Config {
  return convertToPartitionable(config, vgName, targetName, "mdRaids");
}

function convertToVolumeGroup(
  config: ConfigModel.Config,
  vgName: string,
  targetVgName: string,
): ConfigModel.Config {
  config = configModel.clone(config);

  if (vgName === targetVgName) return config;

  const vgConfig = config.volumeGroups?.find((v) => v.vgName === vgName);
  const targetVgConfig = config.volumeGroups?.find((v) => v.vgName === targetVgName);

  if (!vgConfig || !targetVgConfig) return config;

  const lvs = vgConfig.logicalVolumes || [];
  targetVgConfig.logicalVolumes ||= [];
  targetVgConfig.logicalVolumes = [...targetVgConfig.logicalVolumes, ...lvs];

  return config;
}

function isAddingLogicalVolumes(volumeGroup: ConfigModel.VolumeGroup): boolean {
  return (
    volumeGroup.logicalVolumes?.some((l) => l.mountPath && configModel.volume.isNew(l)) || false
  );
}

function isReusingLogicalVolumes(volumeGroup: ConfigModel.VolumeGroup): boolean {
  return volumeGroup.logicalVolumes?.some(configModel.volume.isReused) || false;
}

export default {
  generateName,
  create,
  usedMountPaths,
  find,
  findIndex,
  findByName,
  filterTargetDevices,
  add,
  edit,
  remove,
  convertToPartitionable,
  convertToDrive,
  convertToMdRaid,
  convertToVolumeGroup,
  isAddingLogicalVolumes,
  isReusingLogicalVolumes,
};
