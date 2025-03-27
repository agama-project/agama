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
import { data } from "~/types/storage";

function copyApiModel(apiModel: apiModel.Config): apiModel.Config {
  return JSON.parse(JSON.stringify(apiModel));
}

function buildFilesystem(data?: data.Filesystem): apiModel.Filesystem | undefined {
  if (!data) return;

  return {
    ...data,
    default: false,
  };
}

function buildSize(data?: data.Size): apiModel.Size | undefined {
  if (!data) return;

  return {
    ...data,
    default: false,
    min: data.min || 0,
  };
}

function buildVolumeGroup(data: data.VolumeGroup): apiModel.VolumeGroup {
  const defaultVolumeGroup = { vgName: "system", targetDevices: [] };
  return { ...defaultVolumeGroup, ...data };
}

function buildLogicalVolume(data: data.LogicalVolume): apiModel.LogicalVolume {
  return {
    ...data,
    filesystem: buildFilesystem(data.filesystem),
    size: buildSize(data.size),
  };
}

function buildLogicalVolumeName(mountPath?: string): string | undefined {
  if (!mountPath) return;

  return mountPath === "/" ? "root" : mountPath.split("/").pop();
}

function buildLogicalVolumeFromPartition(partition: apiModel.Partition): apiModel.LogicalVolume {
  return {
    ...partition,
    lvName: buildLogicalVolumeName(partition.mountPath),
  };
}

export {
  copyApiModel,
  buildVolumeGroup,
  buildLogicalVolume,
  buildLogicalVolumeName,
  buildLogicalVolumeFromPartition,
};
