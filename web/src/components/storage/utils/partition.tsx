/*
 * Copyright (c) [2024] SUSE LLC
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

// @ts-check

import { _ } from "~/i18n";
import { sprintf } from "sprintf-js";
import { filesystemType, formattedPath, sizeDescription } from "~/components/storage/utils";
import { configModel } from "~/api/storage/types";

/**
 * String to identify the drive.
 */
const pathWithSize = (partition: configModel.Partition | configModel.LogicalVolume): string => {
  return sprintf(
    // TRANSLATORS: %1$s is an already formatted mount path (eg. "/"),
    // %2$s is a size description (eg. at least 10 GiB)
    _("%1$s (%2$s)"),
    formattedPath(partition.mountPath),
    sizeDescription(partition.size),
  );
};

/**
 * String to identify the type of partition to be created (or used).
 */
const typeDescription = (partition: configModel.Partition | configModel.LogicalVolume): string => {
  const fs = filesystemType(partition.filesystem);

  if (partition.name) {
    if (partition.filesystem.reuse) {
      // TRANSLATORS: %1$s is a filesystem type (eg. Btrfs), %2$s is a device name (eg. /dev/sda3).
      if (fs) return sprintf(_("Current %1$s at %2$s"), fs, partition.name);

      // TRANSLATORS: %s is a device name (eg. /dev/sda3).
      return sprintf(_("Current %s"), partition.name);
    }

    // TRANSLATORS: %1$s is a filesystem type (eg. Btrfs), %2$s is a device name (eg. /dev/sda3).
    return sprintf(_("%1$s at %2$s"), fs, partition.name);
  }
  return fs;
};

/**
 * Combination of {@link typeDescription} and the size of the target partition.
 */
const typeWithSize = (partition: configModel.Partition | configModel.LogicalVolume): string => {
  return sprintf(
    // TRANSLATORS: %1$s is a filesystem type description (eg. "Btrfs with snapshots"),
    // %2$s is a description of the size or the size limits (eg. "at least 10 GiB")
    _("%1$s (%2$s)"),
    typeDescription(partition),
    sizeDescription(partition.size),
  );
};

export { pathWithSize, typeDescription, typeWithSize };
