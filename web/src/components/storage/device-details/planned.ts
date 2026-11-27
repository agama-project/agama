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
import type { ConfigModel, Partitionable } from "~/model/storage/config-model";
import type { Entry } from "~/components/storage/device-details/entry";

/** A partition or logical volume planned for the new system. */
export type Planned = ConfigModel.Partition | ConfigModel.LogicalVolume;

/**
 * The partition id, if any. Some partitions, such as BIOS boot, are requested
 * by id instead of mount point.
 */
export function partitionId(part: Planned): ConfigModel.PartitionId | undefined {
  return "id" in part ? part.id : undefined;
}

/**
 * What is planned on the entry, new or reused, so a device that only mounts an
 * existing partition does not look empty.
 */
export function plannedOn(entry: Entry): Planned[] {
  const parts = entry.isVolumeGroup
    ? (entry.config as ConfigModel.VolumeGroup).logicalVolumes || []
    : (entry.config as Partitionable.Device).partitions || [];

  return parts.filter((part) => {
    /* A new partition requested only by id (BIOS boot, PReP) counts too. */
    if (configModel.volume.isNew(part)) return Boolean(part.mountPath || partitionId(part));
    return Boolean(part.mountPath);
  });
}
