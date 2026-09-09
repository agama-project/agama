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

import { isEmpty } from "radashi";
import { useConfigModel } from "~/hooks/model/storage/config-model";
import { useProposal } from "~/hooks/model/proposal/storage";
import { useDevice } from "~/hooks/model/system/storage";
import type { Partitionable } from "~/model/storage/config-model";

/** A device, and where it is written, which is what changing it needs. */
export type SingleDevice = {
  device: Partitionable.Device;
  collection: Partitionable.CollectionName;
  index: number;
};

/**
 * The device the whole configuration is about, where a single one speaks for it.
 *
 * The page reports one thing either way, and this is what decides how much of
 * that report can be about a device rather than about a plan: a decision the
 * page offers on one disk has no subject at all on three.
 *
 * A lone volume group does not count, although it is a single entry. It is
 * defined rather than found, and a summary of it is a plan about disks it does
 * not name.
 */
function useSingleDevice(): SingleDevice | null {
  const config = useConfigModel();
  if (!config) return null;
  if (!isEmpty(config.volumeGroups || [])) return null;

  const drives = config.drives || [];
  const mdRaids = config.mdRaids || [];
  if (drives.length + mdRaids.length !== 1) return null;

  if (drives.length === 1) return { device: drives[0], collection: "drives", index: 0 };
  return { device: mdRaids[0], collection: "mdRaids", index: 0 };
}

/**
 * Whether the device already holds something the plan has to decide about.
 *
 * On an empty disk there is nothing to keep, shrink or delete, so the decision
 * has no question to answer and the page does not ask it.
 */
function useHasExistingContent(name?: string): boolean {
  const device = useDevice(name || "");
  return !isEmpty(device?.partitions || []);
}

/** Why the new system does not fit on the device the configuration is about. */
type NoRoomReason = "keptContent" | "tooSmall";

/**
 * Why a configuration of a single device has no layout, where the page can see
 * it for itself.
 *
 * The installer reports that it could not work one out and not what stopped it.
 * Two shapes are legible from the configuration and the disk together, and both
 * name a decision the reader can change. Everything else is left to what the
 * page says about a failed layout in general, which names the mount paths it
 * could not place.
 */
function useNoRoomReason(): NoRoomReason | null {
  const proposal = useProposal();
  const singleDevice = useSingleDevice();
  const device = useDevice(singleDevice?.device.name || "");

  if (proposal) return null;
  if (!singleDevice || !device) return null;

  const partitions = device.partitions || [];

  /* The case a reader lands in most: a disk with something on it, and a plan
     that is not allowed to touch any of it. */
  const policy = singleDevice.device.spacePolicy || "keep";
  if (policy === "keep" && !isEmpty(partitions)) return "keptContent";

  /* Nothing to clear away, and nowhere to put anything either. The partition
     table has to be there for that reading, since unused slots are how a disk
     reports its free space: without one there is no zero to read, and calling
     a blank disk too small would be a guess the page cannot back up. */
  const free = (device.partitionTable?.unusedSlots || []).reduce(
    (total, slot) => total + slot.size,
    0,
  );
  if (device.partitionTable && isEmpty(partitions) && free === 0) return "tooSmall";

  return null;
}

export { useSingleDevice, useHasExistingContent, useNoRoomReason };
export type { NoRoomReason };
