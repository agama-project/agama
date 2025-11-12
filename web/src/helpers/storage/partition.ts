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

import { apiModel } from "~/api/storage";
import { copyApiModel, findDevice, buildPartition } from "~/helpers/storage/api-model";
import { isUsed } from "~/helpers/storage/search";
import { data } from "~/types/storage";

type Partitionable = apiModel.Drive | apiModel.MdRaid;

function indexByName(device: Partitionable, name: string): number {
  return (device.partitions || []).findIndex((p) => p.name && p.name === name);
}

function indexByPath(device: Partitionable, path: string): number {
  return (device.partitions || []).findIndex((p) => p.mountPath === path);
}

/**
 * Adds a new partition.
 *
 * If a partition already exists in the model (e.g., as effect of using the custom policy), then
 * the partition is replaced.
 * */
function addPartition(
  apiModel: apiModel.Config,
  list: "drives" | "mdRaids",
  listIndex: number | string,
  data: data.Partition,
): apiModel.Config {
  apiModel = copyApiModel(apiModel);
  const device = findDevice(apiModel, list, listIndex);

  if (device === undefined) return apiModel;

  // Reset the spacePolicy to the default value if the device goes from unused to used
  if (!isUsed(apiModel, list, listIndex) && device.spacePolicy === "keep")
    device.spacePolicy = null;

  const partition = buildPartition(data);
  const index = indexByName(device, partition.name);

  if (index === -1) device.partitions.push(partition);
  else device.partitions[index] = partition;

  return apiModel;
}

function editPartition(
  apiModel: apiModel.Config,
  list: "drives" | "mdRaids",
  listIndex: number | string,
  mountPath: string,
  data: data.Partition,
): apiModel.Config {
  apiModel = copyApiModel(apiModel);
  const device = findDevice(apiModel, list, listIndex);

  if (device === undefined) return apiModel;

  const index = indexByPath(device, mountPath);
  if (index === -1) return apiModel;

  const oldPartition = device.partitions[index];
  const newPartition = { ...oldPartition, ...buildPartition(data) };
  device.partitions.splice(index, 1, newPartition);

  return apiModel;
}

function deletePartition(
  apiModel: apiModel.Config,
  list: "drives" | "mdRaids",
  listIndex: number | string,
  mountPath: string,
): apiModel.Config {
  apiModel = copyApiModel(apiModel);
  const device = findDevice(apiModel, list, listIndex);

  if (device === undefined) return apiModel;

  const index = indexByPath(device, mountPath);
  device.partitions.splice(index, 1);

  // Do not delete anything if the device is not really used
  if (!isUsed(apiModel, list, listIndex)) {
    device.spacePolicy = "keep";
  }

  return apiModel;
}

export { addPartition, editPartition, deletePartition };
