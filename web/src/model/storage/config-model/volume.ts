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

import type { ConfigModel } from "~/model/storage/config-model";

type Volume = ConfigModel.Partition | ConfigModel.LogicalVolume;

function isNew(volume: Volume): boolean {
  return !volume.name;
}

function isUsed(volume: Volume): boolean {
  return volume.filesystem !== undefined;
}

function isReused(volume: Volume): boolean {
  return !isNew(volume) && isUsed(volume);
}

function isUsedBySpacePolicy(volume: Volume): boolean {
  return volume.resizeIfNeeded || volume.delete || volume.deleteIfNeeded;
}

export default { isNew, isUsed, isReused, isUsedBySpacePolicy };
export type { Volume };
