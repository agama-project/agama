/*
 * Copyright (c) [2025-2026] SUSE LLC
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
import { formattedPath } from "~/components/storage/utils";
import { sprintf } from "sprintf-js";
import configModel from "~/model/storage/config-model";
import { isEmpty } from "radashi";
import type { ConfigModel } from "~/model/storage/config-model";

const deleteTextFor = (logicalVolumes: ConfigModel.LogicalVolume[]) => {
  const mandatory = logicalVolumes.filter((l) => l.delete).length;
  const onDemand = logicalVolumes.filter((l) => l.deleteIfNeeded).length;

  if (mandatory === 0 && onDemand === 0) return;
  if (mandatory === 1 && onDemand === 0) return _("A logical volume will be deleted");
  if (mandatory === 1) return _("At least one logical volume will be deleted");
  if (mandatory > 1) return _("Several logical volumes will be deleted");
  if (onDemand === 1) return _("A logical volume may be deleted");

  return _("Some logical volumes may be deleted");
};

/**
 * FIXME: right now, this considers only a particular case because the information from the model is
 * incomplete.
 */
const resizeTextFor = (logicalVolumes: ConfigModel.LogicalVolume[]) => {
  const count = logicalVolumes.filter((l) => l.size?.min === 0).length;

  if (count === 0) return;
  if (count === 1) return _("A logical volume may be shrunk");

  return _("Some logical volumes may be shrunk");
};

const SummaryForSpacePolicy = (volumeGroup: ConfigModel.VolumeGroup): string | undefined => {
  const isAddingLogicalVolumes = configModel.volumeGroup.isAddingLogicalVolumes(volumeGroup);
  const isReusingLogicalVolumes = configModel.volumeGroup.isReusingLogicalVolumes(volumeGroup);

  switch (volumeGroup.spacePolicy) {
    case "delete":
      if (isReusingLogicalVolumes)
        return _("All content not configured to be mounted will be deleted");
      return _("All content will be deleted");
    case "resize":
      if (isReusingLogicalVolumes && !isAddingLogicalVolumes)
        return _("Reused logical volumes will not be shrunk");
      return _("Some existing logical volumes may be shrunk");
    case "keep":
      return _("Current logical volumes will be kept");
    default:
      return undefined;
  }
};

/**
 * This considers only the case in which the volume group contains logical volumes initially and
 * will contain logical volumes after installation.
 *
 * FIXME: the case with two sentences looks a bit weird. But trying to summarize everything in one
 * sentence was too hard.
 */
const contentActionsSummary = (volumeGroup: ConfigModel.VolumeGroup): string => {
  const policyLabel = SummaryForSpacePolicy(volumeGroup);

  if (policyLabel) return policyLabel;

  const logicalVolumes = volumeGroup.logicalVolumes.filter((p) => p.name);
  const deleteText = deleteTextFor(logicalVolumes);
  const resizeText = resizeTextFor(logicalVolumes);

  if (deleteText && resizeText) {
    // TRANSLATORS: this simply concatenates the two sentences that describe what is going to happen
    // with logical volumes. The first %s corresponds to deleted logical volumes and the second one
    // to resized ones.
    return sprintf(_("%s - %s"), deleteText, resizeText);
  }

  if (deleteText) return deleteText;
  if (resizeText) return resizeText;

  // This scenario is unlikely, as the backend is expected to enforce the "keep"
  // space policy when all logical volumes in a custom policy are set to "keep".
  // However, to be safe, we return the same summary as the "keep" policy.
  return _("Current logical volumes will be kept");
};

const ContentActionsDescription = (
  volumeGroup: ConfigModel.VolumeGroup,
  policyId: string | undefined,
): string => {
  const isAddingLogicalVolumes = configModel.volumeGroup.isAddingLogicalVolumes(volumeGroup);
  const isReusingLogicalVolumes = configModel.volumeGroup.isReusingLogicalVolumes(volumeGroup);

  if (!policyId) policyId = volumeGroup.spacePolicy;

  switch (policyId) {
    case "delete":
      if (isReusingLogicalVolumes)
        return _("Logical volumes that are not reused will be removed and that data will be lost.");
      return _(
        "Any existing logical volume will be removed and all data in the volume group will be lost.",
      );
    case "resize":
      if (isReusingLogicalVolumes) {
        if (isAddingLogicalVolumes)
          return _("Logical volumes that are not reused will be resized as needed.");

        return _("Logical volumes that are not reused would be resized if needed.");
      }
      return _("The data is kept, but the current logical volumes will be resized as needed.");
    case "keep":
      if (isReusingLogicalVolumes) {
        if (isAddingLogicalVolumes)
          return _(
            "Only reused logical volumes and space not assigned to any logical volume will be used.",
          );

        return _("Only reused logical volumes will be used.");
      }
      return _("The data is kept. Only the space not assigned to any logical volume will be used.");
    default:
      return _("Select what to do with each logical volume.");
  }
};

const contentDescription = (volumeGroup: ConfigModel.VolumeGroup): string => {
  const newLogicalVolumes = volumeGroup.logicalVolumes.filter(configModel.volume.isNew);
  const reusedLogicalVolumes = volumeGroup.logicalVolumes.filter(configModel.volume.isReused);

  if (isEmpty(newLogicalVolumes)) {
    if (isEmpty(reusedLogicalVolumes)) {
      return _("No additional logical volumes will be created");
    }

    const mountPaths = reusedLogicalVolumes.map((p) => formattedPath(p.mountPath));
    return sprintf(
      // TRANSLATORS: %s is a list of formatted mount points like '"/", "/var" and "swap"' (or a
      // single mount point in the singular case).
      n_(
        "An existing logical volume will be used for %s",
        "Existing logical volumes will be used for %s",
        mountPaths.length,
      ),
      formatList(mountPaths),
    );
  }

  if (isEmpty(reusedLogicalVolumes)) {
    const mountPaths = newLogicalVolumes.map((p) => formattedPath(p.mountPath));
    return sprintf(
      // TRANSLATORS: %s is a list of formatted mount points like '"/", "/var" and "swap"' (or a
      // single mount point in the singular case).
      n_(
        "A new logical volume will be created for %s",
        "New logical volumes will be created for %s",
        mountPaths.length,
      ),
      formatList(mountPaths),
    );
  }

  const mountPaths = newLogicalVolumes
    .concat(reusedLogicalVolumes)
    .map((p) => formattedPath(p.mountPath));
  // TRANSLATORS: %s is a list of formatted mount points like '"/", "/var" and "swap"' (or a
  // single mount point in the singular case).
  return sprintf(_("Logical volumes will be used and created for %s"), formatList(mountPaths));
};

export {
  contentActionsSummary,
  ContentActionsDescription as contentActionsDescription,
  contentDescription,
};
