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

import { createFilesystem, createSize } from "~/model/storage/utils";
import type { ConfigModel, Data } from "~/model/storage/config-model";

function create(data: Data.Partition): ConfigModel.Partition {
  return {
    ...data,
    filesystem: data.filesystem ? createFilesystem(data.filesystem) : undefined,
    size: data.size ? createSize(data.size) : undefined,
    // Using the ESP partition id for /boot/efi may not be strictly required, but it is
    // a good practice. Let's force it here since it cannot be selected in the UI.
    id: data.mountPath === "/boot/efi" ? "esp" : undefined,
  };
}

function createFromLogicalVolume(lv: ConfigModel.LogicalVolume): ConfigModel.Partition {
  return {
    mountPath: lv.mountPath,
    filesystem: lv.filesystem,
    size: lv.size,
  };
}

function isNew(partition: ConfigModel.Partition): boolean {
  return !partition.name;
}

function isUsed(partition: ConfigModel.Partition): boolean {
  return partition.filesystem !== undefined;
}

function isReused(partition: ConfigModel.Partition): boolean {
  return !isNew(partition) && isUsed(partition);
}

function isUsedBySpacePolicy(partition: ConfigModel.Partition): boolean {
  return partition.resizeIfNeeded || partition.delete || partition.deleteIfNeeded;
}

export default { create, createFromLogicalVolume, isNew, isUsed, isReused, isUsedBySpacePolicy };
