/*
 * Copyright (c) [2024-2025] SUSE LLC
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

import { sprintf } from "sprintf-js";
import { deviceLabel } from "./utils";
import { usedMountPaths } from "~/model/storage/config-model/partitionable";
import { _ } from "~/i18n";
import type { model } from "~/storage";
import type { storage } from "~/model/system";

export type MdRaidHeaderProps = { raid: model.MdRaid; device: storage.Device };

const text = (raid: model.MdRaid): string => {
  if (raid.filesystem) {
    // TRANSLATORS: %s will be replaced by a RAID name and its size - "md0 (20 GiB)"
    if (raid.filesystem.reuse) return _("Mount RAID %s");
    // TRANSLATORS: %s will be replaced by a RAID name and its size - "md0 (20 GiB)"
    return _("Format RAID %s");
  }

  const { isBoot, isTargetDevice: hasPv } = raid;
  const isRoot = !!raid.getPartition("/");
  const hasFs = !!usedMountPaths(raid).length;

  if (isRoot) {
    if (hasPv) {
      if (isBoot) {
        // TRANSLATORS: %s will be replaced by the device name and its size - "md0 (20 GiB)"
        return _("Use RAID %s to install, host LVM and boot");
      }
      // TRANSLATORS: %s will be replaced by the device name and its size - "md0 (20 GiB)"
      return _("Use RAID %s to install and host LVM");
    }

    if (isBoot) {
      // TRANSLATORS: %s will be replaced by the device name and its size - "md0 (20 GiB)"
      return _("Use RAID %s to install and boot");
    }
    // TRANSLATORS: %s will be replaced by the device name and its size - "md0 (20 GiB)"
    return _("Use RAID %s to install");
  }

  if (hasFs) {
    if (hasPv) {
      if (isBoot) {
        // TRANSLATORS: %s will be replaced by the device name and its size - "md0 (20 GiB)"
        return _("Use RAID %s for LVM, additional partitions and booting");
      }
      // TRANSLATORS: %s will be replaced by the device name and its size - "md0 (20 GiB)"
      return _("Use RAID %s for LVM and additional partitions");
    }

    if (isBoot) {
      // TRANSLATORS: %s will be replaced by the device name and its size - "md0 (20 GiB)"
      return _("Use RAID %s for additional partitions and booting");
    }
    // TRANSLATORS: %s will be replaced by the device name and its size - "md0 (20 GiB)"
    return _("Use RAID %s for additional partitions");
  }

  if (hasPv) {
    if (isBoot) {
      // TRANSLATORS: %s will be replaced by the device name and its size - "md0 (20 GiB)"
      return _("Use RAID %s to host LVM and boot");
    }
    // TRANSLATORS: %s will be replaced by the device name and its size - "md0 (20 GiB)"
    return _("Use RAID %s to host LVM");
  }

  if (isBoot) {
    // TRANSLATORS: %s will be replaced by the device name and its size - "md0 (20 GiB)"
    return _("Use RAID %s to configure boot partitions");
  }
  // TRANSLATORS: %s will be replaced by the device name and its size - "md0 (20 GiB)"
  return _("Use RAID %s");
};

export default function MdRaidHeader({ raid, device }: MdRaidHeaderProps) {
  return sprintf(text(raid), deviceLabel(device, true));
}
