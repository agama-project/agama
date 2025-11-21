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

import { model } from "~/storage";
import { storage } from "~/api/system";
import { sprintf } from "sprintf-js";
import { deviceLabel } from "./utils";
import { _ } from "~/i18n";

export type DriveHeaderProps = { drive: model.Drive; device: storage.Device };

const text = (drive: model.Drive): string => {
  if (drive.filesystem) {
    // TRANSLATORS: %s will be replaced by a disk name and its size - "sda (20 GiB)"
    if (drive.filesystem.reuse) return _("Mount disk %s");
    // TRANSLATORS: %s will be replaced by a disk name and its size - "sda (20 GiB)"
    return _("Format disk %s");
  }

  const { isBoot, isTargetDevice: hasPv } = drive;
  const isRoot = !!drive.getPartition("/");
  const hasFs = !!drive.getMountPaths().length;

  if (isRoot) {
    if (hasPv) {
      if (isBoot) {
        // TRANSLATORS: %s will be replaced by the device name and its size - "sda (20 GiB)"
        return _("Use disk %s to install, host LVM and boot");
      }
      // TRANSLATORS: %s will be replaced by the device name and its size - "sda (20 GiB)"
      return _("Use disk %s to install and host LVM");
    }

    if (isBoot) {
      // TRANSLATORS: %s will be replaced by the device name and its size - "sda (20 GiB)"
      return _("Use disk %s to install and boot");
    }
    // TRANSLATORS: %s will be replaced by the device name and its size - "sda (20 GiB)"
    return _("Use disk %s to install");
  }

  if (hasFs) {
    if (hasPv) {
      if (isBoot) {
        // TRANSLATORS: %s will be replaced by the device name and its size - "sda (20 GiB)"
        return _("Use disk %s for LVM, additional partitions and booting");
      }
      // TRANSLATORS: %s will be replaced by the device name and its size - "sda (20 GiB)"
      return _("Use disk %s for LVM and additional partitions");
    }

    if (isBoot) {
      // TRANSLATORS: %s will be replaced by the device name and its size - "sda (20 GiB)"
      return _("Use disk %s for additional partitions and booting");
    }
    // TRANSLATORS: %s will be replaced by the device name and its size - "sda (20 GiB)"
    return _("Use disk %s for additional partitions");
  }

  if (hasPv) {
    if (isBoot) {
      // TRANSLATORS: %s will be replaced by the device name and its size - "sda (20 GiB)"
      return _("Use disk %s to host LVM and boot");
    }
    // TRANSLATORS: %s will be replaced by the device name and its size - "sda (20 GiB)"
    return _("Use disk %s to host LVM");
  }

  if (isBoot) {
    // TRANSLATORS: %s will be replaced by the device name and its size - "sda (20 GiB)"
    return _("Use disk %s to configure boot partitions");
  }
  // TRANSLATORS: %s will be replaced by the device name and its size - "sda (20 GiB)"
  return _("Use disk %s");
};

export default function DriveHeader({ drive, device }: DriveHeaderProps) {
  return sprintf(text(drive), deviceLabel(device, true));
}
