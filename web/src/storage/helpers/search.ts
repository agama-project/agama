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

import { apiModel } from "~/api/storage";
import { model } from "~/storage";
import { copyApiModel, findDevice, findDeviceIndex } from "~/storage/helpers/api-model";
import { buildModel } from "~/storage/helpers/model";
import { fork } from "radashi";

function deviceLocation(apiModel: apiModel.Config, name: string) {
  let index;
  for (const list of ["drives", "mdRaids"]) {
    index = findDeviceIndex(apiModel, list, name);
    if (index !== -1) return { list, index };
  }

  return { list: undefined, index: -1 };
}

function buildModelDevice(
  apiModel: apiModel.Config,
  list: string,
  index: number | string,
): model.Drive | model.MdRaid | undefined {
  const model = buildModel(apiModel);
  return model[list].at(index);
}

function isUsed(apiModel: apiModel.Config, list: string, index: number | string): boolean {
  const device = buildModelDevice(apiModel, list, index);
  if (!device) return false;

  return device.isUsed;
}

function deleteIfUnused(apiModel: apiModel.Config, name: string): apiModel.Config {
  apiModel = copyApiModel(apiModel);

  const { list, index } = deviceLocation(apiModel, name);
  if (!list) return apiModel;

  if (isUsed(apiModel, list, index)) return apiModel;

  apiModel[list].splice(index, 1);
  return apiModel;
}

function switchSearched(
  apiModel: apiModel.Config,
  oldName: string,
  name: string,
  list: "drives" | "mdRaids",
): apiModel.Config {
  if (name === oldName) return apiModel;

  apiModel = copyApiModel(apiModel);

  const { list: oldList, index } = deviceLocation(apiModel, oldName);
  if (!oldList) return apiModel;

  const device = findDevice(apiModel, oldList, index);
  const deviceModel = buildModelDevice(apiModel, oldList, index);
  const targetIndex = findDeviceIndex(apiModel, list, name);
  const target = targetIndex === -1 ? null : findDevice(apiModel, list, targetIndex);

  if (deviceModel.filesystem) {
    if (target) {
      target.mountPath = device.mountPath;
      target.filesystem = device.filesystem;
      target.spacePolicy = "keep";
    } else {
      apiModel[list].push({
        name,
        mountPath: device.mountPath,
        filesystem: device.filesystem,
        spacePolicy: "keep",
      });
    }

    apiModel[oldList].splice(index, 1);
    return apiModel;
  }

  const [newPartitions, existingPartitions] = fork(deviceModel.partitions, (p) => p.isNew);
  const reusedPartitions = existingPartitions.filter((p) => p.isReused);
  const keepEntry = deviceModel.isExplicitBoot || reusedPartitions.length;

  if (keepEntry) {
    device.partitions = existingPartitions;
  } else {
    apiModel[oldList].splice(index, 1);
  }

  if (target) {
    target.partitions ||= [];
    target.partitions = [...target.partitions, ...newPartitions];
  } else {
    apiModel[list].push({
      name,
      partitions: newPartitions,
      spacePolicy: device.spacePolicy === "custom" ? undefined : device.spacePolicy,
    });
  }

  return apiModel;
}

export { deleteIfUnused, isUsed, switchSearched };
