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

import { model } from "~/api/storage";
import { copyApiModel, buildLogicalVolume } from "~/storage/helpers/api-model";
import { data } from "~/storage";

function findVolumeGroupIndex(apiModel: model.Config, vgName: string): number {
  return (apiModel.volumeGroups || []).findIndex((v) => v.vgName === vgName);
}

function findLogicalVolumeIndex(volumeGroup: model.VolumeGroup, mountPath: string): number {
  return (volumeGroup.logicalVolumes || []).findIndex((l) => l.mountPath === mountPath);
}

function addLogicalVolume(
  apiModel: model.Config,
  vgName: string,
  data: data.LogicalVolume,
): model.Config {
  apiModel = copyApiModel(apiModel);

  const vgIndex = findVolumeGroupIndex(apiModel, vgName);
  if (vgIndex === -1) return apiModel;

  const volumeGroup = apiModel.volumeGroups[vgIndex];
  const logicalVolume = buildLogicalVolume(data);

  volumeGroup.logicalVolumes ||= [];
  volumeGroup.logicalVolumes.push(logicalVolume);

  return apiModel;
}

function editLogicalVolume(
  apiModel: model.Config,
  vgName: string,
  mountPath: string,
  data: data.LogicalVolume,
): model.Config {
  apiModel = copyApiModel(apiModel);

  const vgIndex = findVolumeGroupIndex(apiModel, vgName);
  if (vgIndex === -1) return apiModel;

  const volumeGroup = apiModel.volumeGroups[vgIndex];

  const lvIndex = findLogicalVolumeIndex(volumeGroup, mountPath);
  if (lvIndex === -1) return apiModel;

  const oldLogicalVolume = volumeGroup.logicalVolumes[lvIndex];
  const newLogicalVolume = { ...oldLogicalVolume, ...buildLogicalVolume(data) };

  volumeGroup.logicalVolumes.splice(lvIndex, 1, newLogicalVolume);

  return apiModel;
}

function deleteLogicalVolume(
  apiModel: model.Config,
  vgName: string,
  mountPath: string,
): model.Config {
  apiModel = copyApiModel(apiModel);

  const vgIndex = findVolumeGroupIndex(apiModel, vgName);
  if (vgIndex === -1) return apiModel;

  const volumeGroup = apiModel.volumeGroups[vgIndex];

  const lvIndex = findLogicalVolumeIndex(volumeGroup, mountPath);
  if (lvIndex === -1) return apiModel;

  volumeGroup.logicalVolumes.splice(lvIndex, 1);

  return apiModel;
}

export { addLogicalVolume, editLogicalVolume, deleteLogicalVolume };
