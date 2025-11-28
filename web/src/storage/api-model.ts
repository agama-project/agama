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

import type { model } from "~/model/storage";
import type { data } from "~/storage";

function copyApiModel(apiModel: model.Config): model.Config {
  return JSON.parse(JSON.stringify(apiModel));
}

function findDevice(apiModel: model.Config, list: string, index: number | string) {
  const collection = apiModel[list] || [];
  return collection.at(index);
}

function findDeviceIndex(apiModel: model.Config, list: string, name: string) {
  const collection = apiModel[list] || [];
  return collection.findIndex((d) => d.name === name);
}

function partitionables(apiModel: model.Config): (model.Drive | model.MdRaid)[] {
  return (apiModel.drives || []).concat(apiModel.mdRaids || []);
}

function buildFilesystem(data?: data.Filesystem): model.Filesystem | undefined {
  if (!data) return;

  return {
    ...data,
    default: false,
  };
}

function buildSize(data?: data.Size): model.Size | undefined {
  if (!data) return;

  return {
    ...data,
    default: false,
    min: data.min || 0,
  };
}

function buildVolumeGroup(data: data.VolumeGroup): model.VolumeGroup {
  const defaultVolumeGroup = { vgName: "system", targetDevices: [] };
  return { ...defaultVolumeGroup, ...data };
}

function buildLogicalVolume(data: data.LogicalVolume): model.LogicalVolume {
  return {
    ...data,
    filesystem: buildFilesystem(data.filesystem),
    size: buildSize(data.size),
  };
}

function buildPartition(data: data.Partition): model.Partition {
  return {
    ...data,
    filesystem: buildFilesystem(data.filesystem),
    size: buildSize(data.size),
    // Using the ESP partition id for /boot/efi may not be strictly required, but it is
    // a good practice. Let's force it here since it cannot be selected in the UI.
    id: data.mountPath === "/boot/efi" ? "esp" : undefined,
  };
}

function buildLogicalVolumeName(mountPath?: string): string | undefined {
  if (!mountPath) return;

  return mountPath === "/" ? "root" : mountPath.split("/").pop();
}

function buildLogicalVolumeFromPartition(partition: model.Partition): model.LogicalVolume {
  return {
    ...partition,
    lvName: buildLogicalVolumeName(partition.mountPath),
  };
}

function buildPartitionFromLogicalVolume(lv: model.LogicalVolume): model.Partition {
  return {
    mountPath: lv.mountPath,
    filesystem: lv.filesystem,
    size: lv.size,
  };
}

export {
  copyApiModel,
  findDevice,
  findDeviceIndex,
  partitionables,
  buildPartition,
  buildVolumeGroup,
  buildLogicalVolume,
  buildLogicalVolumeName,
  buildLogicalVolumeFromPartition,
  buildPartitionFromLogicalVolume,
};
