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

function bootDevice(config: ConfigModel.Config): ConfigModel.Drive | ConfigModel.MdRaid | null {
  const targets = [...config.drives, ...config.mdRaids];
  return targets.find((d) => d.name && d.name === config.boot?.device?.name) || null;
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
  const drives = config.drives || [];
  const mdRaids = config.mdRaids || [];
  const device = drives.concat(mdRaids).find((d) => d.name === deviceName);

  return (
    isExplicitBootDevice(config, deviceName) ||
    isTargetDevice(config, deviceName) ||
    partitionableModel.usedMountPaths(device).length > 0
  );
}

export default {
  usedMountPaths,
  bootDevice,
  hasDefaultBoot,
  isBootDevice,
  isExplicitBootDevice,
  isTargetDevice,
  isUsedDevice,
};
export type { ConfigModel };
