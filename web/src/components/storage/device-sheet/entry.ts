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

import { baseName } from "~/components/storage/utils";
import { useConfigModel } from "~/hooks/model/storage/config-model";
import { useDevice } from "~/hooks/model/system/storage";
import type { ConfigModel, Partitionable } from "~/model/storage/config-model";
import type { SheetEntry } from "~/components/storage/shared/use-sheet";
import type { Storage } from "~/model/system";

/** One entry of the configuration, and the machine's own view of it. */
type Entry = {
  /** What the configuration says: a partitionable device, or a volume group. */
  config: Partitionable.Device | ConfigModel.VolumeGroup;
  /** What the machine reports, where the machine has it at all. */
  device: Storage.Device | null;
  /** What the reader calls it: `sda`, or `system`. */
  name: string;
  /** Whether it is defined here rather than found on the machine. */
  isVolumeGroup: boolean;
};

/**
 * The entry an address names, read once for whatever is showing it.
 *
 * The two kinds of entry are told apart here rather than by every reader of
 * one. Both are looked up on the machine by the same field, which for a volume
 * group is set only once the group exists; what a reader calls it is a
 * different field again, so the pair is worth resolving in one place.
 *
 * An address can name an entry the configuration no longer has, because it was
 * written down, shared, or reloaded after the plan moved on. That reads as
 * nothing rather than as an error.
 */
function useEntry(selection: SheetEntry | null): Entry | null {
  const config = useConfigModel();
  const entry = (selection && config?.[selection.collection]?.[selection.index]) || null;
  const device = useDevice(entry?.name || "");

  if (!entry) return null;

  const isVolumeGroup = "vgName" in entry;

  return {
    config: entry,
    device,
    name: isVolumeGroup ? entry.vgName : baseName(entry.name),
    isVolumeGroup,
  };
}

export { useEntry };
export type { Entry };
