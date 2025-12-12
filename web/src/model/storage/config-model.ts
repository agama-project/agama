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

import { volumeGroupModelMethods, partitionableModelMethods } from "~/model/storage";
import type * as ConfigModel from "~/openapi/storage/config-model";

function usedMountPaths(configModel: ConfigModel.Config): string[] {
  const drives = configModel.drives || [];
  const mdRaids = configModel.mdRaids || [];
  const volumeGroups = configModel.volumeGroups || [];

  return [
    ...drives.flatMap(partitionableModelMethods.usedMountPaths),
    ...mdRaids.flatMap(partitionableModelMethods.usedMountPaths),
    ...volumeGroups.flatMap(volumeGroupModelMethods.usedMountPaths),
  ];
}

function bootDevice(
  configModel: ConfigModel.Config,
): ConfigModel.Drive | ConfigModel.MdRaid | null {
  const targets = [...configModel.drives, ...configModel.mdRaids];
  return targets.find((d) => d.name && d.name === configModel.boot?.device?.name) || null;
}

function hasDefaultBoot(configModel: ConfigModel.Config): boolean {
  return configModel.boot?.device?.default || false;
}

function isBootDevice(configModel: ConfigModel.Config, deviceName: string): boolean {
  return configModel.boot?.configure && configModel.boot.device?.name === deviceName;
}

function isExplicitBootDevice(configModel: ConfigModel.Config, deviceName: string): boolean {
  return isBootDevice(configModel, deviceName) && !hasDefaultBoot(configModel);
}

function isTargetDevice(configModel: ConfigModel.Config, deviceName: string): boolean {
  const targetDevices = (configModel.volumeGroups || []).flatMap((v) => v.targetDevices || []);
  return targetDevices.includes(deviceName);
}

function isUsedDevice(configModel: ConfigModel.Config, deviceName: string): boolean {
  const drives = configModel.drives || [];
  const mdRaids = configModel.mdRaids || [];
  const device = drives.concat(mdRaids).find((d) => d.name === deviceName);

  return (
    isExplicitBootDevice(configModel, deviceName) ||
    isTargetDevice(configModel, deviceName) ||
    partitionableModelMethods.usedMountPaths(device).length > 0
  );
}

export {
  usedMountPaths,
  bootDevice,
  hasDefaultBoot,
  isBootDevice,
  isExplicitBootDevice,
  isTargetDevice,
  isUsedDevice,
};
export type { ConfigModel };
