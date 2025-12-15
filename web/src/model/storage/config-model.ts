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

import partitionableModel from "~/model/storage/partitionable-model";
import volumeGroupModel from "~/model/storage/volume-group-model";
import type * as ConfigModel from "~/openapi/storage/config-model";
import type * as Data from "~/model/storage/data";

type Partitionable = ConfigModel.Drive | ConfigModel.MdRaid;

type PartitionableCollection = "drives" | "mdRaids";

type PartitionableLocation = { collection: PartitionableCollection; index: number };

function isPartitionableCollection(collection: string): collection is PartitionableCollection {
  return collection === "drives" || collection === "mdRaids";
}

function clone(config: ConfigModel.Config): ConfigModel.Config {
  return JSON.parse(JSON.stringify(config));
}

function usedMountPaths(config: ConfigModel.Config): string[] {
  const drives = config.drives || [];
  const mdRaids = config.mdRaids || [];
  const volumeGroups = config.volumeGroups || [];

  return [
    ...drives.flatMap(partitionableModel.usedMountPaths),
    ...mdRaids.flatMap(partitionableModel.usedMountPaths),
    ...volumeGroups.flatMap(volumeGroupModel.usedMountPaths),
  ];
}

function findPartitionableDevice(
  config: ConfigModel.Config,
  collection: PartitionableCollection,
  index: number,
): Partitionable | null {
  const devices = collection === "drives" ? config.drives : config.mdRaids;
  if (!devices) return null;

  return devices.at(index);
}

function filterPartitionableDevices(config: ConfigModel.Config): Partitionable[] {
  const drives = config.drives || [];
  const mdRaids = config.mdRaids || [];
  return [...drives, ...mdRaids];
}

function findPartitionableIndex(
  config: ConfigModel.Config,
  collection: PartitionableCollection,
  name: string,
): number {
  const devices = config[collection] || [];
  return devices.findIndex((d) => d.name === name);
}

function findPartitionableLocation(
  config: ConfigModel.Config,
  name: string,
): PartitionableLocation | null {
  const collections: PartitionableCollection[] = ["drives", "mdRaids"];

  for (const collection of collections) {
    const index = findPartitionableIndex(config, collection, name);
    if (index !== -1) {
      return { collection, index };
    }
  }

  return null;
}

function findBootDevice(config: ConfigModel.Config): Partitionable | null {
  return (
    filterPartitionableDevices(config).find(
      (d) => d.name && d.name === config.boot?.device?.name,
    ) || null
  );
}

function hasDefaultBoot(config: ConfigModel.Config): boolean {
  return config.boot?.device?.default || false;
}

function isBootDevice(config: ConfigModel.Config, deviceName: string): boolean {
  return config.boot?.configure && config.boot.device?.name === deviceName;
}

function isExplicitBootDevice(config: ConfigModel.Config, deviceName: string): boolean {
  return isBootDevice(config, deviceName) && !hasDefaultBoot(config);
}

function isTargetDevice(config: ConfigModel.Config, deviceName: string): boolean {
  const targetDevices = (config.volumeGroups || []).flatMap((v) => v.targetDevices || []);
  return targetDevices.includes(deviceName);
}

function isUsedDevice(config: ConfigModel.Config, deviceName: string): boolean {
  const device = filterPartitionableDevices(config).find((d) => d.name === deviceName);

  return (
    isExplicitBootDevice(config, deviceName) ||
    isTargetDevice(config, deviceName) ||
    partitionableModel.usedMountPaths(device).length > 0
  );
}

function removePartitionableDevice(
  config: ConfigModel.Config,
  collection: PartitionableCollection,
  index: number,
): ConfigModel.Config {
  config = clone(config);
  config[collection]?.splice(index, 1);
  return config;
}

function setBoot(config: ConfigModel.Config, boot: ConfigModel.Boot): ConfigModel.Config {
  config = clone(config);
  const device = findBootDevice(config);
  config.boot = null;

  if (device && !isUsedDevice(config, device.name)) {
    const location = findPartitionableLocation(config, device.name);
    if (location) config = removePartitionableDevice(config, location.collection, location.index);
  }

  config.boot = boot;
  return config;
}

function setBootDevice(config: ConfigModel.Config, deviceName: string): ConfigModel.Config {
  const boot = {
    configure: true,
    device: {
      default: false,
      name: deviceName,
    },
  };

  return setBoot(config, boot);
}

function setDefaultBootDevice(config: ConfigModel.Config): ConfigModel.Config {
  const boot = {
    configure: true,
    device: {
      default: true,
    },
  };

  return setBoot(config, boot);
}

function disableBoot(config: ConfigModel.Config): ConfigModel.Config {
  return setBoot(config, { configure: false });
}

export default {
  isPartitionableCollection,
  clone,
  usedMountPaths,
  findPartitionableDevice,
  filterPartitionableDevices,
  findPartitionableIndex,
  findPartitionableLocation,
  findBootDevice,
  hasDefaultBoot,
  isBootDevice,
  isExplicitBootDevice,
  isTargetDevice,
  isUsedDevice,
  setBootDevice,
  setDefaultBootDevice,
  disableBoot,
};
export type { ConfigModel, Data, Partitionable, PartitionableCollection, PartitionableLocation };
