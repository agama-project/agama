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
    // TRANSLATORS: in the notice saying a mount point is already assigned
    // elsewhere, right after naming what it is assigned to: how that is set
    // up now. %1$s is a file system (e.g. "XFS"), %2$s a size or size range
    // (e.g. "at least 5 GiB").
    _("Currently set up with %1$s, %2$s"),
    filesystem,
    size,
  );
}

/**
 * The holder's other file system settings, as one line, or nothing when it
 * has none. Each is named as its field in the
 * form, with its value quoted. An existing partition that keeps its data
 * brings its own label and is not formatted, so it has no format arguments.
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
      // TRANSLATORS: a setting and its value, in the notice saying a mount
      // point is already assigned elsewhere. %1$s is the setting's name as in its field (e.g. "Label"),
      // %2$s its value (e.g. "home"). Use the quotes of your language.
      _('%1$s "%2$s"'),
      name,
      value,
    );

  const settings = sift([
    // TRANSLATORS: name of a setting, as the field that sets it.
    label && setting(_("Label"), label),
    // TRANSLATORS: name of a setting, as the field that sets it.
    mountOptions.length > 0 && setting(_("Mount options"), mountOptions.join(",")),
    // TRANSLATORS: name of a setting, as the field that sets it.
    formatArguments && setting(_("Additional format arguments"), formatArguments),
  ]);

  return settings.length > 0 ? formatList(settings, { type: "unit", style: "short" }) : undefined;
}
