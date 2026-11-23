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

import { sprintf } from "sprintf-js";
import configModel from "~/model/storage/config-model";
import {
  baseName,
  deviceSize,
  filesystemLabel,
  filesystemType,
  sizeDescription,
} from "~/components/storage/utils";
import { _ } from "~/i18n";

import type { ConfigModel, MountPathHolder } from "~/model/storage/config-model";
import type { Storage as System } from "~/model/system";

type ReleasableHolder = Exclude<MountPathHolder, { kind: "device" }>;

/**
 * What else holds a mount point, when the mount point is taken.
 *
 * @param usedMountPoints - Mount points other devices use.
 */
export function mountPointHolder(
  config: ConfigModel.Config | null,
  usedMountPoints: string[],
  mountPoint: string,
): MountPathHolder | null {
  if (!config || !usedMountPoints.includes(mountPoint)) return null;
  return configModel.findMountPathHolder(config, mountPoint);
}

/**
 * Says what a mount point is assigned to, one whole sentence per kind of
 * holder so each translates on its own.
 */
export function holderTitle(mountPoint: string, holder: MountPathHolder) {
  switch (holder.kind) {
    case "newPartition":
      return sprintf(
        // TRANSLATORS: title of a notice under the mount point field. %1$s is
        // a mount point (e.g. "/home"), %2$s a disk (e.g. "sda"). No final
        // period.
        _("%1$s is already assigned to a new partition on %2$s"),
        mountPoint,
        baseName(holder.deviceName),
      );
    case "existingPartition":
      return sprintf(
        // TRANSLATORS: title of a notice under the mount point field. %1$s is
        // a mount point (e.g. "/home"), %2$s a partition (e.g. "sda2"). No
        // final period.
        _("%1$s is already assigned to %2$s"),
        mountPoint,
        baseName(holder.partitionName),
      );
    case "logicalVolume":
      return sprintf(
        // TRANSLATORS: title of a notice under the mount point field. %1$s is
        // a mount point (e.g. "/home"), %2$s a volume group (e.g. "system").
        // No final period.
        _("%1$s is already assigned to a logical volume in %2$s"),
        mountPoint,
        holder.deviceName,
      );
    case "device":
      return holder.collection === "mdRaids"
        ? sprintf(
            // TRANSLATORS: title of a notice under the mount point field. %1$s
            // is a mount point (e.g. "/srv"), %2$s a RAID device (e.g. "md0").
            // No final period.
            _("%1$s is already assigned to the RAID %2$s"),
            mountPoint,
            baseName(holder.deviceName),
          )
        : sprintf(
            // TRANSLATORS: title of a notice under the mount point field. %1$s
            // is a mount point (e.g. "/srv"), %2$s a disk (e.g. "sdb"). No
            // final period.
            _("%1$s is already assigned to the disk %2$s"),
            mountPoint,
            baseName(holder.deviceName),
          );
  }
}

/**
 * Says what becomes of the holder once the mount point is assigned here, one
 * whole sentence per kind of holder.
 */
export function holderOutcome(mountPoint: string, holder: ReleasableHolder) {
  switch (holder.kind) {
    case "newPartition":
      return sprintf(
        // TRANSLATORS: hint under the option to assign a mount point to this
        // partition instead. %s is a disk (e.g. "sda"). No final period.
        _("The new partition on %s will no longer be created"),
        baseName(holder.deviceName),
      );
    case "existingPartition":
      return sprintf(
        // TRANSLATORS: hint under the option to assign a mount point to this
        // partition instead. %1$s is a partition (e.g. "sda2"), %2$s a mount
        // point (e.g. "/home"). No final period.
        _("%1$s will no longer be used for %2$s"),
        baseName(holder.partitionName),
        mountPoint,
      );
    case "logicalVolume":
      return sprintf(
        // TRANSLATORS: hint under the option to assign a mount point to this
        // partition instead. %s is a volume group (e.g. "system"). No final
        // period.
        _("The logical volume in %s will no longer be created"),
        holder.deviceName,
      );
  }
}

/**
 * Says how the holder is set up now: its file system and size. An existing
 * partition that keeps its data brings its own, so they are read from the
 * machine.
 *
 * @param partition - The holder as it is on the machine, when it is an
 *   existing partition.
 */
export function holderSetup(holder: ReleasableHolder, partition?: System.Device) {
  const { entry } = holder;
  const isExisting = holder.kind === "existingPartition";
  const keepsData = isExisting && entry.filesystem?.reuse === true;
  const currentType = partition?.filesystem?.type;

  const filesystem =
    (keepsData && currentType ? filesystemLabel(currentType) : undefined) ||
    (entry.filesystem && filesystemType(entry.filesystem)) ||
    // TRANSLATORS: said where the installer has not been told which file
    // system to use.
    _("default");

  let size: string;
  if (isExisting && partition?.block?.size) {
    size = deviceSize(partition.block.size);
  } else if (entry.size) {
    size = sizeDescription(entry.size);
  } else {
    // TRANSLATORS: said where the size of something the installer creates is
    // left to it.
    size = _("decided by the installer");
  }

  return sprintf(
    // TRANSLATORS: in the notice saying a mount point is already assigned
    // elsewhere, how that is set up now. %1$s is a file system (e.g. "Btrfs"),
    // %2$s a size or size range (e.g. "10 GiB - 20 GiB").
    _("Currently: %1$s, %2$s"),
    filesystem,
    size,
  );
}
