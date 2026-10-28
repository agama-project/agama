/*
 * Copyright (c) [2026] SUSE LLC
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

import configModel from "~/model/storage/config-model";
import type { Volume } from "~/model/storage/config-model/volume";
import type { ConfigModel, Data } from "~/model/storage/config-model";
import type { Storage as System } from "~/model/system";

type Device = ConfigModel.Drive | ConfigModel.MdRaid | ConfigModel.VolumeGroup;

function volumes(device: Device): Volume[] {
  if ("partitions" in device) return device.partitions || [];

  if ("logicalVolumes" in device) return device.logicalVolumes || [];

  return [];
}

function findVolumeByMountPath(device: Device, mountPath: string): Volume | null {
  return volumes(device).find((v) => v.mountPath === mountPath) ?? null;
}

function convertPartitionable(
  config: ConfigModel.Config,
  device: System.Device,
  targetDevice: System.Device,
) {
  if (targetDevice.class === "drive") {
    return configModel.partitionable.convertToDrive(config, device.name, {
      name: targetDevice.name,
    });
  }
  if (targetDevice.class === "mdRaid") {
    return configModel.partitionable.convertToMdRaid(config, device.name, {
      name: targetDevice.name,
    });
  }
  if (targetDevice.class === "volumeGroup") {
    return configModel.partitionable.convertToVolumeGroup(config, device.name, targetDevice.name);
  }
}

const extractVgName = (name: string) => name.split("/").pop();

function convertVolumeGroup(
  config: ConfigModel.Config,
  device: System.Device,
  targetDevice: System.Device,
) {
  const vgName = extractVgName(device.name);
  if (targetDevice.class === "drive") {
    return configModel.volumeGroup.convertToDrive(config, vgName, targetDevice.name);
  }
  if (targetDevice.class === "mdRaid") {
    return configModel.volumeGroup.convertToMdRaid(config, vgName, targetDevice.name);
  }
  if (targetDevice.class === "volumeGroup") {
    const targetVgName = extractVgName(targetDevice.name);
    return configModel.volumeGroup.convertToVolumeGroup(config, vgName, targetVgName);
  }
}

function convert(
  config: ConfigModel.Config,
  device: System.Device,
  targetDevice: System.Device,
): ConfigModel.Config {
  if (device.class === "drive") return convertPartitionable(config, device, targetDevice);
  if (device.class === "mdRaid") return convertPartitionable(config, device, targetDevice);
  if (device.class === "volumeGroup") return convertVolumeGroup(config, device, targetDevice);

  return config;
}

function addSpaceActions(volumes: Volume[], actions: Data.SpacePolicyAction[]): Volume[] {
  // Reset resize/delete actions of all current volumes.
  volumes
    .filter((v) => v.name !== undefined)
    .forEach((volume) => {
      volume.delete = false;
      volume.deleteIfNeeded = false;
      volume.resizeIfNeeded = false;
      volume.size = undefined;
    });

  // Apply the given actions.
  actions.forEach(({ deviceName, value }) => {
    const isDelete = value === "delete";
    const isResizeIfNeeded = value === "resizeIfNeeded";
    const volume = volumes.find((v) => v.name === deviceName);

    if (volume) {
      volume.delete = isDelete;
      volume.resizeIfNeeded = isResizeIfNeeded;
    } else {
      volumes.push({
        name: deviceName,
        delete: isDelete,
        resizeIfNeeded: isResizeIfNeeded,
      });
    }
  });

  return volumes;
}

function setSpacePolicy(
  config: ConfigModel.Config,
  collection: "drives" | "mdRaids" | "volumeGroups",
  index: number,
  data: Data.SpacePolicy,
): ConfigModel.Config {
  config = configModel.clone(config);
  const deviceConfig: Device = config[collection]?.at(index);

  if (!deviceConfig) return config;

  deviceConfig.spacePolicy = data.type;
  if (data.type !== "custom") return config;

  if ("partitions" in deviceConfig) {
    const volumes = addSpaceActions(deviceConfig.partitions || [], data.actions || []);
    deviceConfig.partitions = volumes;
  }

  if ("logicalVolumes" in deviceConfig) {
    const volumes = addSpaceActions(deviceConfig.logicalVolumes || [], data.actions || []);
    deviceConfig.logicalVolumes = volumes;
  }

  return config;
}

export default { volumes, findVolumeByMountPath, convert, setSpacePolicy };
export type { Device };
