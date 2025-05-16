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

import { apiModel } from "~/api/storage/types";
import { copyApiModel, findDevice } from "~/helpers/storage/api-model";
import { data } from "~/types/storage";

function setActions(device: apiModel.Drive, actions: SpacePolicyAction[]) {
  device.partitions ||= [];

  // Reset resize/delete actions of all current partition configs.
  device.partitions
    .filter((p) => p.name !== undefined)
    .forEach((partition) => {
      partition.delete = false;
      partition.deleteIfNeeded = false;
      partition.resizeIfNeeded = false;
      partition.size = undefined;
    });

  // Apply the given actions.
  actions.forEach(({ deviceName, value }) => {
    const isDelete = value === "delete";
    const isResizeIfNeeded = value === "resizeIfNeeded";
    const partition = device.partitions.find((p) => p.name === deviceName);

    if (partition) {
      partition.delete = isDelete;
      partition.resizeIfNeeded = isResizeIfNeeded;
    } else {
      device.partitions.push({
        name: deviceName,
        delete: isDelete,
        resizeIfNeeded: isResizeIfNeeded,
      });
    }
  });
}

function setSpacePolicy(
  apiModel: apiModel.Config,
  list: string,
  listIndex: number | string,
  data: data.SpacePolicy,
): apiModel.Config {
  apiModel = copyApiModel(apiModel);
  const apiDevice = findDevice(apiModel, list, listIndex);

  if (apiDevice === undefined) return apiModel;

  apiDevice.spacePolicy = data.type;
  if (data.type === "custom") setActions(apiDevice, data.actions || []);

  return apiModel;
}

export { setSpacePolicy };
