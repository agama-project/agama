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

import { sift } from "radashi";
import { partitionModelMethods } from "~/model/storage";
import type { configModel } from "~/model/storage";
import type * as model from "~/storage/model";

// FIXME: remove model types once model is dropped.
type Partitionable = configModel.Drive | configModel.MdRaid | model.Drive | model.MdRaid;

function usedMountPaths(device: Partitionable): string[] {
  const mountPaths = (device.partitions || []).map((p) => p.mountPath);
  return sift([device.mountPath, ...mountPaths]);
}

function isAddingPartitions(device: Partitionable): boolean {
  return device.partitions.some((p) => p.mountPath && partitionModelMethods.isNew(p));
}

function isReusingPartitions(device: Partitionable): boolean {
  return device.partitions.some(partitionModelMethods.isReused);
}

export { usedMountPaths, isAddingPartitions, isReusingPartitions };
