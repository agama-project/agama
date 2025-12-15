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
    ...drives.flatMap(partitionableModel.usedMountPaths),
    ...mdRaids.flatMap(partitionableModel.usedMountPaths),
    ...volumeGroups.flatMap(volumeGroupModel.usedMountPaths),
  ];
}

function findBootDevice(config: ConfigModel.Config): Partitionable.Device | null {
  return (
    partitionable.all(config).find((d) => d.name && d.name === config.boot?.device?.name) || null
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

function setBoot(config: ConfigModel.Config, boot: ConfigModel.Boot): ConfigModel.Config {
  config = clone(config);
  const device = findBootDevice(config);
  config.boot = null;

  if (device && !partitionable.isUsed(config, device.name)) {
    const location = partitionable.findLocation(config, device.name);
    if (location) config = partitionable.remove(config, location.collection, location.index);
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
  clone,
  usedMountPaths,
  findBootDevice,
  hasDefaultBoot,
  isBootDevice,
  isExplicitBootDevice,
  isTargetDevice,
  setBootDevice,
  setDefaultBootDevice,
  disableBoot,
  partitionable,
};
export type { ConfigModel, Data, Partitionable };
