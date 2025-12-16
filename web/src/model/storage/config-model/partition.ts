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
import { createFilesystem, createSize } from "~/model/storage/utils";
import configModel from "~/model/storage/config-model";
import type { ConfigModel, Data, Partitionable } from "~/model/storage/config-model";

function indexByName(device: Partitionable.Device, name: string): number {
  return (device.partitions || []).findIndex((p) => p.name && p.name === name);
}

function indexByPath(device: Partitionable.Device, path: string): number {
  return (device.partitions || []).findIndex((p) => p.mountPath === path);
}

function create(data: Data.Partition): ConfigModel.Partition {
  return {
    ...data,
    filesystem: data.filesystem ? createFilesystem(data.filesystem) : undefined,
    size: data.size ? createSize(data.size) : undefined,
    // Using the ESP partition id for /boot/efi may not be strictly required, but it is
    // a good practice. Let's force it here since it cannot be selected in the UI.
    id: data.mountPath === "/boot/efi" ? "esp" : undefined,
  };
}

function createFromLogicalVolume(lv: ConfigModel.LogicalVolume): ConfigModel.Partition {
  return {
    mountPath: lv.mountPath,
    filesystem: lv.filesystem,
    size: lv.size,
  };
}

/**
 * Adds a new partition.
 *
 * If a partition already exists in the model (e.g., as effect of using the custom policy), then
 * the partition is replaced.
 * */
function add(
  config: ConfigModel.Config,
  collection: Partitionable.CollectionName,
  index: number,
  data: Data.Partition,
): ConfigModel.Config {
  config = configModel.clone(config);
  const device = configModel.partitionable.find(config, collection, index);

  if (device === undefined) return config;

  // Reset the spacePolicy to the default value if the device goes from unused to used
  if (!configModel.partitionable.isUsed(config, device.name) && device.spacePolicy === "keep")
    device.spacePolicy = null;

  const partition = create(data);
  const partitionIndex = indexByName(device, partition.name);

  if (partitionIndex === -1) device.partitions.push(partition);
  else device.partitions[partitionIndex] = partition;

  return config;
}

function edit(
  config: ConfigModel.Config,
  collection: Partitionable.CollectionName,
  index: number,
  mountPath: string,
  data: Data.Partition,
): ConfigModel.Config {
  config = configModel.clone(config);
  const device = configModel.partitionable.find(config, collection, index);

  if (device === undefined) return config;

  const partitionIndex = indexByPath(device, mountPath);
  if (partitionIndex === -1) return config;

  const oldPartition = device.partitions[partitionIndex];
  const newPartition = { ...oldPartition, ...create(data) };
  device.partitions.splice(partitionIndex, 1, newPartition);

  return config;
}

function remove(
  config: ConfigModel.Config,
  collection: Partitionable.CollectionName,
  index: number,
  mountPath: string,
): ConfigModel.Config {
  config = configModel.clone(config);
  const device = configModel.partitionable.find(config, collection, index);

  if (device === undefined) return config;

  const partitionIndex = indexByPath(device, mountPath);
  device.partitions.splice(partitionIndex, 1);

  // Do not delete anything if the device is not really used
  if (!configModel.partitionable.isUsed(config, device.name)) {
    device.spacePolicy = "keep";
  }

  return config;
}

function isNew(partition: ConfigModel.Partition): boolean {
  return !partition.name;
}

function isUsed(partition: ConfigModel.Partition): boolean {
  return partition.filesystem !== undefined;
}

function isReused(partition: ConfigModel.Partition): boolean {
  return !isNew(partition) && isUsed(partition);
}

function isUsedBySpacePolicy(partition: ConfigModel.Partition): boolean {
  return partition.resizeIfNeeded || partition.delete || partition.deleteIfNeeded;
}

export default {
  create,
  createFromLogicalVolume,
  add,
  edit,
  remove,
  isNew,
  isUsed,
  isReused,
  isUsedBySpacePolicy,
};
