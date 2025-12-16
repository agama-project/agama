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

import volumeGroupModel from "~/model/storage/volume-group-model";
import boot from "~/model/storage/config-model/boot";
import partitionable from "~/model/storage/config-model/partitionable";
import type * as ConfigModel from "~/openapi/storage/config-model";
import type * as Data from "~/model/storage/data";
import type * as Partitionable from "~/model/storage/config-model/partitionable";

function clone(config: ConfigModel.Config): ConfigModel.Config {
  return JSON.parse(JSON.stringify(config));
}

function usedMountPaths(config: ConfigModel.Config): string[] {
  const drives = config.drives || [];
  const mdRaids = config.mdRaids || [];
  const volumeGroups = config.volumeGroups || [];

  return [
    ...drives.flatMap(partitionable.usedMountPaths),
    ...mdRaids.flatMap(partitionable.usedMountPaths),
    ...volumeGroups.flatMap(volumeGroupModel.usedMountPaths),
  ];
}

function isTargetDevice(config: ConfigModel.Config, deviceName: string): boolean {
  const targetDevices = (config.volumeGroups || []).flatMap((v) => v.targetDevices || []);
  return targetDevices.includes(deviceName);
}

export default {
  clone,
  usedMountPaths,
  isTargetDevice,
  boot,
  partitionable,
};
export type { ConfigModel, Data, Partitionable };
