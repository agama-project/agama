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
import type { DetailsSubject } from "~/components/storage/shared/use-device-details";
import type { Storage } from "~/model/system";

/** A storage configuration entry and its system device. */
type Entry = {
  /** The configuration of a partitionable device or a volume group. */
  config: Partitionable.Device | ConfigModel.VolumeGroup;
  /** The system device, if it exists. */
  device: Storage.Device | null;
  /** The name shown to the user, such as `sda` or `system`. */
  name: string;
  /** Whether it is defined here rather than found on the machine. */
  isVolumeGroup: boolean;
};

/**
 * The entry the address names, with its system device. Null when the address
 * names an entry the configuration no longer has.
 */
function useEntry(selection: DetailsSubject | null): Entry | null {
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
