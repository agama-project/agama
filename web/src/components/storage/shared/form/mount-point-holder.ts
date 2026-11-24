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

import { sift } from "radashi";
import { sprintf } from "sprintf-js";
import configModel from "~/model/storage/config-model";
import {
  baseName,
  deviceSize,
  filesystemLabel,
  filesystemType,
  sizeDescription,
} from "~/components/storage/utils";
import { _, formatList } from "~/i18n";

import type { ConfigModel, MountPathHolder } from "~/model/storage/config-model";
import type { Storage as System } from "~/model/system";
import type { MountPointFields } from "./fields";

/** A holder that can give its mount point up: a partition or a logical volume. */
export type ReleasableHolder = Exclude<MountPathHolder, { kind: "device" }>;

/**
 * What else holds a mount point, when the mount point is taken and its holder
 * can give it up. A disk or RAID used as a whole cannot, so it is left to the
 * mount point validation.
 *
 * @param usedMountPoints - Mount points other devices use.
 */
export function mountPointHolder(
  config: ConfigModel.Config | null | undefined,
  usedMountPoints: string[],
  mountPoint: string,
): ReleasableHolder | null {
  if (!config || !usedMountPoints.includes(mountPoint)) return null;

  const holder = configModel.findMountPathHolder(config, mountPoint);
  return configModel.canReleaseMountPath(holder) ? holder : null;
}

/**
 * Whether the user chose to take the mount point over from where it is
 * assigned now. The choice counts only for the mount point it was made for,
 * which is also the one the user finished entering.
 */
export function isReassigning(
  fields: MountPointFields,
  usedMountPoints: string[],
  config?: ConfigModel.Config | null,
) {
  const { mountPoint, committedMountPoint, reassignedMountPoint } = fields;
  if (reassignedMountPoint !== mountPoint || committedMountPoint !== mountPoint) return false;

  return !!mountPointHolder(config, usedMountPoints, mountPoint);
}

/**
 * Says what a mount point is assigned to, one whole sentence per kind of
 * holder so each translates on its own.
 */
export function holderTitle(mountPoint: string, holder: ReleasableHolder) {
  switch (holder.kind) {
    case "newPartition":
      return sprintf(
        // TRANSLATORS: %1$s is a mount point, %2$s a disk (e.g. "sda").
        _("%1$s is already assigned to a new partition on %2$s"),
        mountPoint,
        baseName(holder.deviceName),
      );
    case "existingPartition":
      return sprintf(
        // TRANSLATORS: %1$s is a mount point, %2$s a partition (e.g. "sda2").
        _("%1$s is already assigned to %2$s"),
        mountPoint,
        baseName(holder.partitionName),
      );
    case "logicalVolume":
      return sprintf(
        // TRANSLATORS: %1$s is a mount point, %2$s a volume group (e.g. "system").
        _("%1$s is already assigned to a logical volume in %2$s"),
        mountPoint,
        holder.deviceName,
      );
  }
}

/**
 * The holder's file system and size as they are now. An existing partition
 * that keeps its data brings its own, so they are read from the machine.
 */
function holderFilesystemAndSize(holder: ReleasableHolder, partition?: System.Device) {
  const { entry } = holder;
  const isExisting = holder.kind === "existingPartition";
  const keepsData = isExisting && entry.filesystem?.reuse === true;
  const currentType = partition?.filesystem?.type;

  const filesystem =
    (keepsData && currentType ? filesystemLabel(currentType) : undefined) ||
    (entry.filesystem && filesystemType(entry.filesystem)) ||
    _("default");

  let size: string;
  if (isExisting && partition?.block?.size) {
    size = deviceSize(partition.block.size);
  } else if (entry.size) {
    size = sizeDescription(entry.size);
  } else {
    size = _("decided by the installer");
  }

  return { filesystem, size };
}

/**
 * How the holder is set up now: its file system and size.
 *
 * @param partition - The holder as it is on the machine, when it is an
 *   existing partition.
 */
export function holderBasics(holder: ReleasableHolder, partition?: System.Device) {
  const { filesystem, size } = holderFilesystemAndSize(holder, partition);
  return sprintf(
    // TRANSLATORS: %1$s is a file system (e.g. "XFS"), %2$s a size or range
    // (e.g. "at least 5 GiB").
    _("Currently set up as %1$s, %2$s"),
    filesystem,
    size,
  );
}

/**
 * The holder's other file system settings, as one line, or nothing when it
 * has none. Each is named as its field in the form, with its value quoted. An
 * existing partition that keeps its data brings its own label and is not
 * formatted, so it has no format arguments.
 *
 * @param partition - The holder as it is on the machine, when it is an
 *   existing partition.
 */
export function holderExtras(holder: ReleasableHolder, partition?: System.Device) {
  const filesystem = holder.entry.filesystem;
  const keepsData = holder.kind === "existingPartition" && filesystem?.reuse === true;
  const label = keepsData ? partition?.filesystem?.label : filesystem?.label;
  const mountOptions = filesystem?.mountOptions ?? [];
  const formatArguments = keepsData ? undefined : filesystem?.mkfsExtraArguments;

  const setting = (name: string, value: string) =>
    sprintf(
      // TRANSLATORS: a setting name and its value (e.g. Label "home"). Use the
      // quotes of your language.
      _('%1$s "%2$s"'),
      name,
      value,
    );

  const settings = sift([
    label && setting(_("Label"), label),
    mountOptions.length > 0 && setting(_("Mount options"), mountOptions.join(",")),
    formatArguments && setting(_("Additional format arguments"), formatArguments),
  ]);

  return settings.length > 0 ? formatList(settings, { type: "unit", style: "short" }) : undefined;
}
