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

import { _, n_, formatList, TranslatedString } from "~/i18n";
import { baseName, formattedPath } from "~/components/storage/utils";
import { useConfigModel } from "~/hooks/model/storage/config-model";
import configModel from "~/model/storage/config-model";
import { sprintf } from "sprintf-js";
import type { ConfigModel } from "~/model/storage/config-model";

/**
 * String to identify the drive.
 */
const label = (drive: ConfigModel.Drive): string => {
  return baseName(drive.name);
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

const SummaryForSpacePolicy = (drive: ConfigModel.Drive): string | undefined => {
  const config = useConfigModel();
  const isTargetDevice = configModel.isTargetDevice(config, drive.name);
  const isBoot = configModel.boot.hasDevice(config, drive.name);
  const isAddingPartitions = configModel.partitionable.isAddingPartitions(drive);
  const isReusingPartitions = configModel.partitionable.isReusingPartitions(drive);
  const { spacePolicy } = drive;

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
const contentActionsSummary = (drive: ConfigModel.Drive): TranslatedString[] => {
  const policyLabel = SummaryForSpacePolicy(drive);

  if (policyLabel) return [policyLabel as TranslatedString];

  const partitions = drive.partitions.filter((p) => p.name);
  const deleteText = deleteTextFor(partitions);
  const resizeText = resizeTextFor(partitions);

  if (deleteText && resizeText) {
    return [deleteText as TranslatedString, resizeText as TranslatedString];
  }

  if (deleteText) return [deleteText as TranslatedString];
  if (resizeText) return [resizeText as TranslatedString];

  // This scenario is unlikely, as the backend is expected to enforce the "keep"
  // space policy when all partitions in a custom policy are set to "keep".
  // However, to be safe, we return the same summary as the "keep" policy.
  return [_("Current partitions will be kept")];
};

const ContentActionsDescription = (
  drive: ConfigModel.Drive,
  policyId: string | undefined,
): string => {
  const config = useConfigModel();
  const isTargetDevice = configModel.isTargetDevice(config, drive.name);
  const isBoot = configModel.boot.hasDevice(config, drive.name);
  const isAddingPartitions = configModel.partitionable.isAddingPartitions(drive);
  const isReusingPartitions = configModel.partitionable.isReusingPartitions(drive);

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

const contentDescription = (drive: ConfigModel.Drive): TranslatedString[] => {
  const newPartitions = drive.partitions.filter((p) => !p.name);
  const reusedPartitions = drive.partitions.filter((p) => p.name && p.mountPath);
  const lines: TranslatedString[] = [];

  if (drive.filesystem) {
    if (drive.mountPath) {
      lines.push(sprintf(_("Use the whole device %s"), formattedPath(drive.mountPath)));
    }

    // I don't think this can happen, maybe when loading a configuration not created with the UI
    lines.push(_("Use the whole device for a file system"));
  }

  if (newPartitions.length) {
    const mountPaths = newPartitions.map((p) => formattedPath(p.mountPath));
    lines.push(
      sprintf(
        // TRANSLATORS: %s is a list of formatted mount points like '"/", "/var" and "swap"' (or a
        // single mount point in the singular case).
        n_("Create a partition for %s", "Create new partitions for %s", mountPaths.length),
        formatList(mountPaths),
      ),
    );
  }

  if (reusedPartitions.length) {
    const mountPaths = reusedPartitions.map((p) => formattedPath(p.mountPath));
    lines.push(
      sprintf(
        // TRANSLATORS: %s is a list of formatted mount points like '"/", "/var" and "swap"' (or a
        // single mount point in the singular case).
        n_("Use an existing partition for %s", "Use existing partitions for %s", mountPaths.length),
        formatList(mountPaths),
      ),
    );
  }

  return lines;
};

export {
  label,
  contentActionsSummary,
  ContentActionsDescription as contentActionsDescription,
  contentDescription,
};
