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

import { _, n_, formatList } from "~/i18n";
import { DriveElement } from "~/api/storage/types";
import { SpacePolicy, SPACE_POLICIES, baseName, formattedPath } from "~/components/storage/utils";
import * as partitionUtils from "~/components/storage/utils/partition";

/**
 * String to identify the drive.
 */
const label = (drive: DriveElement): string => {
  if (drive.alias) return drive.alias;

  return baseName(drive.name);
};

const spacePolicyEntry = (drive: DriveElement): SpacePolicy => {
  return SPACE_POLICIES.find((p) => p.id === drive.spacePolicy);
};

const deleteTextFor = (partitions) => {
  const mandatory = partitions.filter((p) => p.delete).length;
  const onDemand = partitions.filter((p) => p.deleteIfNeeded).length;

  if (mandatory === 0 && onDemand === 0) return;
  if (mandatory === 1 && onDemand === 0) return _("A partition will be deleted");
  if (mandatory === 1) return _("At least one partition will be deleted");
  if (mandatory > 1) return _("Several partitions will be deleted");
  if (onDemand === 1) return _("A partition may be deleted");

  return _("Some partitions may be deleted");
};

/**
 * FIXME: right now, this considers only a particular case because the information from the model is
 * incomplete.
 */
const resizeTextFor = (partitions) => {
  const count = partitions.filter((p) => p.size?.min === 0).length;

  if (count === 0) return;
  if (count === 1) return _("A partition may be shrunk");

  return _("Some partitions may be shrunk");
};

/**
 * FIXME: right now, this considers only the case in which the drive is going to be partitioned. If
 * it's directly used (as LVM PV, as MD member, to host a filesystem...) the content wil be deleted
 * anyways. That must be properly stated.
 *
 * FIXME: the case with two sentences looks a bit weird. But trying to summarize everything in one
 * sentence was too hard.
 */
const contentActionsDescription = (drive: DriveElement): string => {
  const policyLabel = spacePolicyEntry(drive).summaryLabel;

  if (policyLabel) return _(policyLabel);

  const partitions = drive.partitions.filter((p) => p.name);
  const deleteText = deleteTextFor(partitions);
  const resizeText = resizeTextFor(partitions);

  if (deleteText && resizeText) {
    // TRANSLATORS: this simply concatenates the two sentences that describe what is going to happen
    // with partitions. The first %s corresponds to deleted partitions and the second one to resized
    // ones.
    return sprintf(_("%s - %s"), deleteText, resizeText);
  }

  if (deleteText) return deleteText;
  if (resizeText) return resizeText;

  return _(SPACE_POLICIES.find((p) => p.id === "keep").summaryLabel);
};

/**
 * FIXME: right now, this considers only the case in which the drive is going to host some formatted
 * partitions.
 */
const contentDescription = (drive: DriveElement): string => {
  const newPartitions = drive.partitions.filter((p) => !p.name);
  const reusedPartitions = drive.partitions.filter((p) => p.name && p.mountPath);

  if (newPartitions.length === 0) {
    if (reusedPartitions.length == 0) {
      // fixme: this is one of the several cases we need to handle better
      return "";
    }

    const mountPaths = reusedPartitions.map((p) => formattedPath(p.mountPath));
    return sprintf(
      // TRANSLATORS: %s is a list of formatted mount points like '"/", "/var" and "swap"' (or a
      // single mount point in the singular case).
      n_(
        "An existing partition will be used for %s",
        "Existing partitions will be used for %s",
        mountPaths.length,
      ),
      formatList(mountPaths),
    );
  }

  if (reusedPartitions.length == 0) {
    const mountPaths = newPartitions.map((p) => partitionUtils.pathWithSize(p));
    return sprintf(
      // TRANSLATORS: %s is a list of formatted mount points with a partition size like
      // '"/" (at least 10 GiB), "/var" (20 GiB) and "swap" (2 GiB)'
      // (or a single mount point in the singular case).
      n_(
        "A new partition will be created for %s",
        "New partitions will be created for %s",
        mountPaths.length,
      ),
      formatList(mountPaths),
    );
  }

  const mountPaths = newPartitions.concat(reusedPartitions).map((p) => formattedPath(p.mountPath));
  // TRANSLATORS: %s is a list of formatted mount points like '"/", "/var" and "swap"' (or a
  // single mount point in the singular case).
  return sprintf(_("Partitions will be used and created for %s"), formatList(mountPaths));
};

const hasFilesystem = (drive: DriveElement): boolean => {
  return drive.partitions && drive.partitions.some((p) => p.mountPath);
};

const hasRoot = (drive: DriveElement): boolean => {
  return drive.partitions && drive.partitions.some((p) => p.mountPath && p.mountPath === "/");
};

const hasReuse = (drive: DriveElement): boolean => {
  return drive.partitions && drive.partitions.some((p) => p.mountPath && p.name);
};

const hasPv = (drive: DriveElement): boolean => {
  return drive.volumeGroups && drive.volumeGroups.length > 0;
};

const explicitBoot = (drive: DriveElement): boolean => {
  return drive.boot && drive.boot === "explicit";
};

export {
  hasPv,
  hasReuse,
  hasFilesystem,
  hasRoot,
  explicitBoot,
  label,
  spacePolicyEntry,
  contentActionsDescription,
  contentDescription,
};
