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
import { DriveElement } from "~/api/storage/types";
import { SpacePolicy, SPACE_POLICIES, baseName } from "~/components/storage/utils";


/**
 * String to identify the drive.
 */
const label = (drive: DriveElement): string => {
  if (drive.alias) return drive.alias;

  return baseName(drive.name);
};

const spacePolicyEntry = (drive: DriveElement): SpacePolicy => {
  return SPACE_POLICIES.find((p) => p.id === drive.spacePolicy);
}

const deleteTextFor = (partitions) => {
  const mandatory = partitions.filter((p) => p.delete).length;
  const onDemand = partitions.filter((p) => p.deleteIfNeeded).length;

  if (mandatory === 0 && onDemand === 0) return;
  if (mandatory === 1 && onDemand === 0) return _("A partition will be deleted.");
  if (mandatory === 1) return _("At least one partition will be deleted.");
  if (mandatory > 1) return _("Several partitions will be deleted.");
  if (onDemand === 1) return _("A partition may be deleted.");

  return _("Some partitions may be deleted.");
};

/**
 * FIXME: right now, this considers only a particular case because the information from the model is
 * incomplete.
 */
const resizeTextFor = (partitions) => {
  const count = partitions.filter((p) => p.size?.min === 0).length;

  if (count === 0) return;
  if (count === 1) return _("A partition may be shrunk.");

  return _("Some partitions may be shrunk.");
};

/**
 * FIXME: right now, this considers only the case in which the drive is going to be partitioned. If
 * its directly used (as LVM PV, as MD member, to host a filesystem...) the content wil be deleted
 * anyways. That must be properly stated.
 */
const oldContentActionsDescription = (drive: DriveElement): string => {
  const policyLabel = spacePolicyEntry(drive).summaryLabel;

  if (policyLabel) return _(policyLabel);


  const partitions = drive.partitions.filter((p) => p.name);
  const deleteText = deleteTextFor(partitions);
  const resizeText = resizeTextFor(partitions);

  if (deleteText && resizeText) {
    // TRANSLATORS: this simply concatenates the two sentences that describe what is going to happen
    // with partitions. The first %s corresponds to deleted partitions and the second one to resized
    // ones.
    return sprintf(_("%s %s"), deleteText, resizeText);
  }

  if (deleteText) return deleteText;
  if (resizeText) return resizeText;

  return _(SPACE_POLICIES.find((p) => p.id === "keep").summaryLabel);
};

/**
 * FIXME: right now, this considers only the case in which the drive is going to host some formatted
 * partitions.
 *
 * FIXME: We probably want to format the mount points a bit (eg. use "root" for "/" or use some
 * markup).
 */
const contentDescription = (drive: DriveElement): string => {
  const partitions = drive.partitions.filter((p) => !p.name)

  // FIXME: this is one of the several cases we need to handle better
  if (partitions.length === 0) return "";

  // FIXME: Use the Intl.ListFormat instead of the `join(", ")` used below.
  // Most probably, a `listFormat` or similar wrapper should live in src/i18n.js or so.
  // Read https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/ListFormat
  return sprintf(_("New partitions will be created for %s"), partitions.map((p) => p.mountPath).join(", "));
};

export {
  label,
  spacePolicyEntry,
  oldContentActionsDescription,
  contentDescription
};
