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

import { copyApiModel, buildLogicalVolume } from "~/storage/api-model";
import type { ConfigModel } from "~/model/storage";
import type { Data } from "~/storage";

function findVolumeGroupIndex(config: ConfigModel.Config, vgName: string): number {
  return (config.volumeGroups || []).findIndex((v) => v.vgName === vgName);
}

function findLogicalVolumeIndex(volumeGroup: ConfigModel.VolumeGroup, mountPath: string): number {
  return (volumeGroup.logicalVolumes || []).findIndex((l) => l.mountPath === mountPath);
}

function addLogicalVolume(
  config: ConfigModel.Config,
  vgName: string,
  data: Data.LogicalVolume,
): ConfigModel.Config {
  config = copyApiModel(config);

  const vgIndex = findVolumeGroupIndex(config, vgName);
  if (vgIndex === -1) return config;

  const volumeGroup = config.volumeGroups[vgIndex];
  const logicalVolume = buildLogicalVolume(data);

  volumeGroup.logicalVolumes ||= [];
  volumeGroup.logicalVolumes.push(logicalVolume);

  return config;
}

function editLogicalVolume(
  config: ConfigModel.Config,
  vgName: string,
  mountPath: string,
  data: Data.LogicalVolume,
): ConfigModel.Config {
  config = copyApiModel(config);

  const vgIndex = findVolumeGroupIndex(config, vgName);
  if (vgIndex === -1) return config;

  const volumeGroup = config.volumeGroups[vgIndex];

  const lvIndex = findLogicalVolumeIndex(volumeGroup, mountPath);
  if (lvIndex === -1) return config;

  const oldLogicalVolume = volumeGroup.logicalVolumes[lvIndex];
  const newLogicalVolume = { ...oldLogicalVolume, ...buildLogicalVolume(data) };

  volumeGroup.logicalVolumes.splice(lvIndex, 1, newLogicalVolume);

  return config;
}

function deleteLogicalVolume(
  config: ConfigModel.Config,
  vgName: string,
  mountPath: string,
): ConfigModel.Config {
  config = copyApiModel(config);

  const vgIndex = findVolumeGroupIndex(config, vgName);
  if (vgIndex === -1) return config;

  const volumeGroup = config.volumeGroups[vgIndex];

  const lvIndex = findLogicalVolumeIndex(volumeGroup, mountPath);
  if (lvIndex === -1) return config;

  volumeGroup.logicalVolumes.splice(lvIndex, 1);

  return config;
}

export { addLogicalVolume, editLogicalVolume, deleteLogicalVolume };
