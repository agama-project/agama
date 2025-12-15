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

import { fork } from "radashi";
import configModel from "~/model/storage/config-model";
import partitionModel from "~/model/storage/partition-model";
import type { ConfigModel, Partitionable } from "~/model/storage/config-model";

function deleteIfUnused(config: ConfigModel.Config, name: string): ConfigModel.Config {
  config = configModel.clone(config);

  const location = configModel.partitionable.findLocation(config, name);
  if (!location) return config;

  const { collection, index } = location;
  const device = configModel.partitionable.find(config, collection, index);
  if (!device) return config;
  if (configModel.partitionable.isUsed(config, device.name)) return config;

  config[collection].splice(index, 1);
  return config;
}

function switchSearched(
  config: ConfigModel.Config,
  oldName: string,
  name: string,
  collection: Partitionable.CollectionName,
): ConfigModel.Config {
  if (name === oldName) return config;

  config = configModel.clone(config);

  const location = configModel.partitionable.findLocation(config, oldName);
  if (!location) return config;

  const device = configModel.partitionable.find(config, location.collection, location.index);
  const targetIndex = configModel.partitionable.findIndex(config, collection, name);
  const target =
    targetIndex === -1 ? null : configModel.partitionable.find(config, collection, targetIndex);

  if (device.filesystem) {
    if (target) {
      target.mountPath = device.mountPath;
      target.filesystem = device.filesystem;
      target.spacePolicy = "keep";
    } else {
      config[collection].push({
        name,
        mountPath: device.mountPath,
        filesystem: device.filesystem,
        spacePolicy: "keep",
      });
    }

    config[location.collection].splice(location.index, 1);
    return config;
  }

  const [newPartitions, existingPartitions] = fork(device.partitions, partitionModel.isNew);
  const reusedPartitions = existingPartitions.filter(partitionModel.isReused);
  const keepEntry =
    configModel.isExplicitBootDevice(config, device.name) || reusedPartitions.length;

  if (keepEntry) {
    device.partitions = existingPartitions;
  } else {
    config[location.collection].splice(location.index, 1);
  }

  if (target) {
    target.partitions ||= [];
    target.partitions = [...target.partitions, ...newPartitions];
  } else {
    config[collection].push({
      name,
      partitions: newPartitions,
      spacePolicy: device.spacePolicy === "custom" ? undefined : device.spacePolicy,
    });
  }

  return config;
}

export { deleteIfUnused, switchSearched };
