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

import React from "react";
import { _ } from "~/i18n";
import { apiModel } from "~/api/storage/types";
import DeviceHeader from "~/components/storage/DeviceHeader";

export type PartitionableHeaderProps = {
  device: apiModel.Drive | apiModel.MdRaid;
  children: React.ReactNode;
};

export default function PartitionableHeader({ device, children }: PartitionableHeaderProps) {
  const { isBoot, isTargetDevice: hasPv } = device;
  const isRoot = !!device.getPartition("/");
  const hasFs = !!device.getMountPaths().length;

  const text = (): string => {
    if (isRoot) {
      if (hasPv) {
        if (isBoot) {
          // TRANSLATORS: %s will be replaced by the device name and its size - "/dev/sda, 20 GiB"
          return _("Use %s to install, host LVM and boot");
        }
        // TRANSLATORS: %s will be replaced by the device name and its size - "/dev/sda, 20 GiB"
        return _("Use %s to install and host LVM");
      }

      if (isBoot) {
        // TRANSLATORS: %s will be replaced by the device name and its size - "/dev/sda, 20 GiB"
        return _("Use %s to install and boot");
      }
      // TRANSLATORS: %s will be replaced by the device name and its size - "/dev/sda, 20 GiB"
      return _("Use %s to install");
    }

    if (hasFs) {
      if (hasPv) {
        if (isBoot) {
          // TRANSLATORS: %s will be replaced by the device name and its size - "/dev/sda, 20 GiB"
          return _("Use %s for LVM, additional partitions and booting");
        }
        // TRANSLATORS: %s will be replaced by the device name and its size - "/dev/sda, 20 GiB"
        return _("Use %s for LVM and additional partitions");
      }

      if (isBoot) {
        // TRANSLATORS: %s will be replaced by the device name and its size - "/dev/sda, 20 GiB"
        return _("Use %s for additional partitions and booting");
      }
      // TRANSLATORS: %s will be replaced by the device name and its size - "/dev/sda, 20 GiB"
      return _("Use %s for additional partitions");
    }

    if (hasPv) {
      if (isBoot) {
        // TRANSLATORS: %s will be replaced by the device name and its size - "/dev/sda, 20 GiB"
        return _("Use %s to host LVM and boot");
      }
      // TRANSLATORS: %s will be replaced by the device name and its size - "/dev/sda, 20 GiB"
      return _("Use %s to host LVM");
    }

    if (isBoot) {
      // TRANSLATORS: %s will be replaced by the device name and its size - "/dev/sda, 20 GiB"
      return _("Use %s to configure boot partitions");
    }
    // TRANSLATORS: %s will be replaced by the device name and its size - "/dev/sda, 20 GiB"
    return _("Use %s");
  };

  return <DeviceHeader title={text(device)}>{children}</DeviceHeader>;
}
