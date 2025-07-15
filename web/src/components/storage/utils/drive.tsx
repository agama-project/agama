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

import { _, n_, formatList } from "~/i18n";
import { apiModel } from "~/api/storage/types";
import { Drive } from "~/types/storage/model";
import {
  SpacePolicy,
  SPACE_POLICIES,
  baseName,
  formattedPath,
  filesystemType,
} from "~/components/storage/utils";
import { sprintf } from "sprintf-js";

/**
 * String to identify the drive.
 */
const label = (drive: apiModel.Drive): string => {
  return baseName(drive.name);
};

const spacePolicyEntry = (drive: apiModel.Drive): SpacePolicy => {
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

const summaryForSpacePolicy = (drive: Drive): string | undefined => {
  const { isBoot, isTargetDevice, isAddingPartitions, isReusingPartitions, spacePolicy } = drive;

  switch (spacePolicy) {
    case "delete":
      if (isReusingPartitions) return _("All content not configured to be mounted will be deleted");
      return _("All content will be deleted");
    case "resize":
      if (isReusingPartitions && !isBoot && !isTargetDevice && !isAddingPartitions)
        return _("Reused partitions will not be shrunk");
      return _("Some existing partitions may be shrunk");
    case "keep":
      return _("Current partitions will be kept");
    default:
      return undefined;
  }
};

/**
 * This considers only the case in which the drive contains partitions initially and will contain
 * partitions after installation.
 *
 * FIXME: the case with two sentences looks a bit weird. But trying to summarize everything in one
 * sentence was too hard.
 */
const contentActionsSummary = (drive: Drive): string => {
  const policyLabel = summaryForSpacePolicy(drive);

  if (policyLabel) return policyLabel;

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

  // This scenario is unlikely, as the backend is expected to enforce the "keep"
  // space policy when all partitions in a custom policy are set to "keep".
  // However, to be safe, we return the same summary as the "keep" policy.
  return _("Current partitions will be kept");
};

const contentActionsDescription = (drive: Drive, policyId: string | undefined): string => {
  const { isBoot, isTargetDevice, isAddingPartitions, isReusingPartitions } = drive;
  if (!policyId) policyId = drive.spacePolicy;

  switch (policyId) {
    case "delete":
      if (isReusingPartitions)
        return _("Partitions that are not reused will be removed and that data will be lost.");
      return _("Any existing partition will be removed and all data in the disk will be lost.");
    case "resize":
      if (isReusingPartitions) {
        if (isBoot || isTargetDevice || isAddingPartitions)
          return _("Partitions that are not reused will be resized as needed.");

        return _("Partitions that are not reused would be resized if needed.");
      }
      return _("The data is kept, but the current partitions will be resized as needed.");
    case "keep":
      if (isReusingPartitions) {
        if (isBoot || isTargetDevice || isAddingPartitions)
          return _("Only reused partitions and space not assigned to any partition will be used.");

        return _("Only reused partitions will be used.");
      }
      return _("The data is kept. Only the space not assigned to any partition will be used.");
    default:
      return _("Select what to do with each partition.");
  }
};

const contentDescription = (drive: apiModel.Drive): string => {
  const newPartitions = drive.partitions.filter((p) => !p.name);
  const reusedPartitions = drive.partitions.filter((p) => p.name && p.mountPath);

  if (drive.filesystem) {
    if (drive.mountPath) {
      return sprintf(_("The device will be used for %s"), drive.mountPath);
    } else {
      return sprintf(_("The device will formatted as %s"), filesystemType(drive.filesystem));
    }
  }

  if (newPartitions.length === 0) {
    if (reusedPartitions.length === 0) {
      return _("No additional partitions will be created");
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

  if (reusedPartitions.length === 0) {
    const mountPaths = newPartitions.map((p) => formattedPath(p.mountPath));
    return sprintf(
      // TRANSLATORS: %s is a list of formatted mount points like '"/", "/var" and "swap"' (or a
      // single mount point in the singular case).
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

export {
  label,
  spacePolicyEntry,
  contentActionsSummary,
  contentActionsDescription,
  contentDescription,
};
