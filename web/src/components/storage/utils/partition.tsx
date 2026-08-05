/*
 * Copyright (c) [2024-2026] SUSE LLC
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

/**
 * @fixme This utils file smells. It accepts both partition and logical volume, but the file is
 *  called partition.tsx. Moreover, some logic (e.g., checking whether a file system is reused) can
 *  be moved to the model hook.
 */

import { _ } from "~/i18n";
import { sprintf } from "sprintf-js";
import { filesystemType, formattedPath, sizeDescription } from "~/components/storage/utils";
import type { ConfigModel } from "~/model/storage/config-model";

/**
 * String to identify the partition.
 */
const pathWithSize = (partition: ConfigModel.Partition): string => {
  return sprintf(
    // TRANSLATORS: %1$s is an already formatted mount path (eg. "/"),
    // %2$s is a size description (eg. at least 10 GiB)
    _("%1$s (%2$s)"),
    formattedPath(partition.mountPath),
    sizeDescription(partition.size),
  );
};

/**
 * String to identify the type of device to be created (or used).
 */
const typeDescription = (partition: ConfigModel.Partition | ConfigModel.LogicalVolume): string => {
  const fsType = partition.filesystem ? filesystemType(partition.filesystem) : undefined;
  if (partition.name) {
    if (partition.filesystem?.reuse) {
      // FIXME: the following "if (fsType)" line is commented out as a hotfix for bsc#1271008.
      // Turns out fsType is not the current filesystem type, but the one that would be used if
      // reusing the current one would not be possible. Commenting out the line is a cheap
      // mitigation that avoids displaying wrong information while we design a better mechanism.

      // TRANSLATORS: %1$s is a filesystem type (eg. Btrfs), %2$s is a device name (eg. /dev/sda3).
      //if (fsType) return sprintf(_("Current %1$s at %2$s"), fsType, partition.name);

      // TRANSLATORS: %s is a device name (eg. /dev/sda3).
      return sprintf(_("Current %s"), partition.name);
    }
    // TRANSLATORS: %1$s is a filesystem type (eg. Btrfs), %2$s is a device name (eg. /dev/sda3).
    return sprintf(_("%1$s at %2$s"), fsType, partition.name);
  }
  return fsType || "";
};

/**
 * Combination of {@link typeDescription} and the size of the target partition.
 */
const typeWithSize = (partition: ConfigModel.Partition | ConfigModel.LogicalVolume): string => {
  return sprintf(
    // TRANSLATORS: %1$s is a filesystem type description (eg. "Btrfs with snapshots"),
    // %2$s is a description of the size or the size limits (eg. "at least 10 GiB")
    _("%1$s (%2$s)"),
    typeDescription(partition),
    sizeDescription(partition.size),
  );
};

export { pathWithSize, typeWithSize };
