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

import { fork, sift } from "radashi";
import { createFilesystem } from "~/model/storage/config-model/utils";
import configModel from "~/model/storage/config-model";
import type { ConfigModel, Data } from "~/model/storage/config-model";

type Device = ConfigModel.Drive | ConfigModel.MdRaid;

type CollectionName = "drives" | "mdRaids";

type Location = { collection: CollectionName; index: number };

function isCollectionName(collection: string): collection is CollectionName {
  return collection === "drives" || collection === "mdRaids";
}

function all(config: ConfigModel.Config): Device[] {
  const drives = config.drives || [];
  const mdRaids = config.mdRaids || [];
  return [...drives, ...mdRaids];
}

function findByName(config: ConfigModel.Config, deviceName: string): Device | null {
  return all(config).find((d) => d.name === deviceName) || null;
}

function find(
  config: ConfigModel.Config,
  collection: CollectionName,
  index: number,
): Device | null {
  return config[collection]?.at(index) || null;
}

function findIndex(config: ConfigModel.Config, collection: CollectionName, name: string): number {
  const devices = config[collection] || [];
  return devices.findIndex((d) => d.name === name);
}

function findLocation(config: ConfigModel.Config, name: string): Location | null {
  const collections: CollectionName[] = ["drives", "mdRaids"];

  for (const collection of collections) {
    const index = findIndex(config, collection, name);
    if (index !== -1) {
      return { collection, index };
    }
  }

  return null;
}

function findPartition(device: Device, mountPath: string): ConfigModel.Partition | undefined {
  return device.partitions?.find((p) => p.mountPath === mountPath);
}

function filterVolumeGroups(config: ConfigModel.Config, device: Device): ConfigModel.VolumeGroup[] {
  const volumeGroups = config.volumeGroups || [];
  return volumeGroups.filter((v) =>
    configModel.volumeGroup.filterTargetDevices(config, v).some((d) => d.name === device.name),
  );
}

function filterConfiguredExistingPartitions(device: Device): ConfigModel.Partition[] {
  if (device.spacePolicy === "custom")
    return device.partitions.filter(
      (p) =>
        !configModel.volume.isNew(p) &&
        (configModel.volume.isUsed(p) || configModel.volume.isUsedBySpacePolicy(p)),
    );

  return device.partitions.filter(configModel.volume.isReused);
}

function usedMountPaths(device: Device): string[] {
  const mountPaths = (device.partitions || []).map((p) => p.mountPath);
  return sift([device.mountPath, ...mountPaths]);
}

function isUsed(config: ConfigModel.Config, deviceName: string): boolean {
  const device = all(config).find((d) => d.name === deviceName);

  return (
    configModel.boot.hasExplicitDevice(config, deviceName) ||
    configModel.isTargetDevice(config, deviceName) ||
    usedMountPaths(device).length > 0
  );
}

function isAddingPartitions(device: Device): boolean {
  return device.partitions?.some((p) => p.mountPath && configModel.volume.isNew(p)) || false;
}

function isReusingPartitions(device: Device): boolean {
  return device.partitions?.some(configModel.volume.isReused) || false;
}

function remove(
  config: ConfigModel.Config,
  collection: CollectionName,
  index: number,
): ConfigModel.Config {
  config = configModel.clone(config);
  config[collection]?.splice(index, 1);
  return config;
}

function removeIfUnused(config: ConfigModel.Config, name: string): ConfigModel.Config {
  if (isUsed(config, name)) return config;

  const location = findLocation(config, name);
  if (!location) return config;

  return remove(config, location.collection, location.index);
}

function convert(
  config: ConfigModel.Config,
  oldName: string,
  name: string,
  collection: CollectionName,
): ConfigModel.Config {
  if (name === oldName) return config;

  config = configModel.clone(config);

  const location = configModel.partitionable.findLocation(config, oldName);
  if (!location) return config;

  const device = configModel.partitionable.find(config, location.collection, location.index);
  const targetIndex = configModel.partitionable.findIndex(config, collection, name);
  const target =
    targetIndex === -1 ? null : configModel.partitionable.find(config, collection, targetIndex);

  if (device.filesystem) {
    if (target) {
      target.mountPath = device.mountPath;
      target.filesystem = device.filesystem;
      target.spacePolicy = "keep";
    } else {
      config[collection].push({
        name,
        mountPath: device.mountPath,
        filesystem: device.filesystem,
        spacePolicy: "keep",
      });
    }

    config[location.collection].splice(location.index, 1);
    return config;
  }

  const [newPartitions, existingPartitions] = fork(device.partitions, configModel.volume.isNew);
  const reusedPartitions = existingPartitions.filter(configModel.volume.isReused);
  const keepEntry =
    configModel.boot.hasExplicitDevice(config, device.name) || reusedPartitions.length;

  if (keepEntry) {
    device.partitions = existingPartitions;
  } else {
    config[location.collection].splice(location.index, 1);
  }

  if (target) {
    target.partitions ||= [];
    target.partitions = [...target.partitions, ...newPartitions];
  } else {
    config[collection].push({
      name,
      partitions: newPartitions,
      spacePolicy: device.spacePolicy === "custom" ? undefined : device.spacePolicy,
    });
  }

  return config;
}

function convertToDrive(
  config: ConfigModel.Config,
  name: string,
  driveData: Data.Drive,
): ConfigModel.Config {
  return convert(config, name, driveData.name, "drives");
}

function convertToMdRaid(
  config: ConfigModel.Config,
  name: string,
  mdRaidData: Data.MdRaid,
): ConfigModel.Config {
  return convert(config, name, mdRaidData.name, "mdRaids");
}

function convertPartitionsToLogicalVolumes(
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
    ...newPartitions.map(configModel.partition.convertToLogicalVolume),
  ];
}

function convertToVolumeGroup(
  config: ConfigModel.Config,
  devName: string,
  targetName?: string,
): ConfigModel.Config {
  config = configModel.clone(config);

  const device = all(config).find((d) => d.name === devName);
  if (!device) return config;

  let volumeGroup: ConfigModel.VolumeGroup;

  if (targetName) {
    volumeGroup = config.volumeGroups?.find((v) => v.name === targetName);
    volumeGroup ||= configModel.volumeGroup.create({
      name: targetName,
      vgName: targetName.split("/").pop(),
    });
  } else {
    volumeGroup = configModel.volumeGroup.create({
      vgName: configModel.volumeGroup.generateName(config),
      targetDevices: [devName],
    });
  }
  convertPartitionsToLogicalVolumes(device, volumeGroup);
  config.volumeGroups ||= [];
  if (!config.volumeGroups.find((v) => v.name === targetName))
    config.volumeGroups.push(volumeGroup);

  config = removeIfUnused(config, devName);

  return config;
}

function setFilesystem(
  config: ConfigModel.Config,
  collection: CollectionName,
  index: number,
  data: Data.Formattable,
): ConfigModel.Config {
  config = configModel.clone(config);

  const device = find(config, collection, index);
  if (!device) return config;

  device.mountPath = data.mountPath;
  device.filesystem = data.filesystem ? createFilesystem(data.filesystem) : undefined;
  return config;
}

export default {
  isCollectionName,
  all,
  find,
  findByName,
  findIndex,
  findLocation,
  findPartition,
  filterVolumeGroups,
  filterConfiguredExistingPartitions,
  usedMountPaths,
  isUsed,
  isAddingPartitions,
  isReusingPartitions,
  remove,
  removeIfUnused,
  convertToDrive,
  convertToMdRaid,
  convertPartitionsToLogicalVolumes,
  convertToVolumeGroup,
  setFilesystem,
};
export type { Device, CollectionName, Location };
