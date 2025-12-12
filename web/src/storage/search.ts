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

import { copyApiModel, findDevice, findDeviceIndex } from "~/storage/api-model";
import { fork } from "radashi";
import { configModel, partitionModel } from "~/model/storage";
import type { ConfigModel } from "~/model/storage";

function deviceLocation(config: ConfigModel.Config, name: string) {
  let index;
  for (const list of ["drives", "mdRaids"]) {
    index = findDeviceIndex(config, list, name);
    if (index !== -1) return { list, index };
  }

  return { list: undefined, index: -1 };
}

function buildModelDevice(
  config: ConfigModel.Config,
  list: string,
  index: number | string,
): ConfigModel.Drive | ConfigModel.MdRaid | undefined {
  return config[list].at(index);
}

function isUsed(config: ConfigModel.Config, list: string, index: number | string): boolean {
  const device = config[list].at(index);
  if (!device) return false;

  return configModel.isUsedDevice(config, device.name);
}

function deleteIfUnused(config: ConfigModel.Config, name: string): ConfigModel.Config {
  config = copyApiModel(config);

  const { list, index } = deviceLocation(config, name);
  if (!list) return config;

  if (isUsed(config, list, index)) return config;

  config[list].splice(index, 1);
  return config;
}

function switchSearched(
  config: ConfigModel.Config,
  oldName: string,
  name: string,
  list: "drives" | "mdRaids",
): ConfigModel.Config {
  if (name === oldName) return config;

  config = copyApiModel(config);

  const { list: oldList, index } = deviceLocation(config, oldName);
  if (!oldList) return config;

  const device = findDevice(config, oldList, index);
  const deviceModel = buildModelDevice(config, oldList, index);
  const targetIndex = findDeviceIndex(config, list, name);
  const target = targetIndex === -1 ? null : findDevice(config, list, targetIndex);

  if (deviceModel.filesystem) {
    if (target) {
      target.mountPath = device.mountPath;
      target.filesystem = device.filesystem;
      target.spacePolicy = "keep";
    } else {
      config[list].push({
        name,
        mountPath: device.mountPath,
        filesystem: device.filesystem,
        spacePolicy: "keep",
      });
    }

    config[oldList].splice(index, 1);
    return config;
  }

  const [newPartitions, existingPartitions] = fork(deviceModel.partitions, partitionModel.isNew);
  const reusedPartitions = existingPartitions.filter(partitionModel.isReused);
  const keepEntry =
    configModel.isExplicitBootDevice(config, deviceModel.name) || reusedPartitions.length;

  if (keepEntry) {
    device.partitions = existingPartitions;
  } else {
    config[oldList].splice(index, 1);
  }

  if (target) {
    target.partitions ||= [];
    target.partitions = [...target.partitions, ...newPartitions];
  } else {
    config[list].push({
      name,
      partitions: newPartitions,
      spacePolicy: device.spacePolicy === "custom" ? undefined : device.spacePolicy,
    });
  }

  return config;
}

export { deleteIfUnused, isUsed, switchSearched };
