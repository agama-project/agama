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

import React from "react";
import MenuButton, { MenuButtonItem } from "~/components/core/MenuButton";
import RowMenuToggle from "~/components/storage/entries-table/RowMenuToggle";
import { useSetSpacePolicy } from "~/hooks/model/storage/config-model";
import { _, TranslatedString } from "~/i18n";
import type { ConfigModel, DeviceCollection } from "~/model/storage/config-model";

/** Safest first, so the one that loses data comes last. */
const POLICIES: ConfigModel.SpacePolicy[] = ["keep", "resize", "delete"];

/** The title of each item. */
function label(
  policy: ConfigModel.SpacePolicy,
  isVolumeGroup: boolean,
  someReused: boolean,
): TranslatedString {
  switch (policy) {
    case "delete":
      if (isVolumeGroup) {
        // TRANSLATORS: one of the choices for what may happen to the logical
        // volumes of a volume group, to make room for the new system.
        return _("Delete all logical volumes");
      }

      return someReused
        ? // TRANSLATORS: one of the choices for what may happen to the
          // partitions of a disk, to make room for the new system. Partitions
          // used by the new system have a mount point and are left alone.
          _("Delete all partitions with no mount point")
        : // TRANSLATORS: one of the choices for what may happen to the
          // partitions of a disk, to make room for the new system.
          _("Delete all partitions");
    case "resize":
      return isVolumeGroup
        ? // TRANSLATORS: one of the choices for what may happen to the logical
          // volumes of a volume group, to make room for the new system.
          _("Shrink logical volumes if needed and possible")
        : // TRANSLATORS: one of the choices for what may happen to the
          // partitions of a disk, to make room for the new system.
          _("Shrink partitions if needed and possible");
    case "keep":
      return isVolumeGroup
        ? // TRANSLATORS: one of the choices for what may happen to the logical
          // volumes of a volume group, to make room for the new system.
          _("Keep all logical volumes")
        : // TRANSLATORS: one of the choices for what may happen to the
          // partitions of a disk, to make room for the new system.
          _("Keep all partitions");
  }
}

/**
 * Read under each item before it is taken, which is when it is worth knowing.
 * What it ends up doing to the device is said by the sentence beside the
 * menu.
 */
function meaning(policy: ConfigModel.SpacePolicy): TranslatedString {
  switch (policy) {
    case "delete":
      // TRANSLATORS: description of "Delete all partitions". "Their" means the
      // partitions or logical volumes (must fit both nouns).
      return _("Their data is lost and their space is freed.");
    case "resize":
      // TRANSLATORS: description of "Shrink partitions if needed and possible".
      return _("The size of some existing partitions may be reduced, keeping their data.");
    case "keep":
      // TRANSLATORS: description of "Keep all partitions".
      return _("Only the currently available space will be used for new partitions.");
  }
}

export type SpaceDecisionProps = {
  collection: DeviceCollection;
  index: number;
  /** What the device allows its partitions today. */
  policy: ConfigModel.SpacePolicy;
  /** Whether any of the partitions or logical volumes have an assigned mount point */
  someReused?: boolean;
  /** The element saying what happens to the partitions today. */
  describedBy?: string;
};

/**
 * Gives every part of a device the new system does not use the same action at
 * once: keep, shrink if needed and possible, or delete.
 *
 * A menu of actions, like the menu on each row of the partitions list. Its
 * items act when chosen and mark none as taken: what each part ends up with is
 * read in the sentence beside the menu and in the list. Parts the new system
 * uses keep what it does with them.
 */
export default function SpaceDecision({
  collection,
  index,
  policy,
  someReused = false,
  describedBy,
}: SpaceDecisionProps) {
  const setSpacePolicy = useSetSpacePolicy();
  const isVolumeGroup = collection === "volumeGroups";

  /* Choosing what the device already allows changes nothing, so nothing is
     written. */
  const choose = (next: ConfigModel.SpacePolicy) => {
    if (next !== policy) setSpacePolicy(collection, index, { type: next });
  };

  const name = isVolumeGroup
    ? // TRANSLATORS: names a menu of actions applied to every logical volume
      // of a volume group at once, to make room for the new system.
      _("Actions for all logical volumes")
    : // TRANSLATORS: names a menu of actions applied to every partition of a
      // disk at once, to make room for the new system.
      _("Actions for all partitions");

  return (
    <MenuButton
      menuProps={{ "aria-label": name, popperProps: { position: "end" } }}
      customToggle={
        <RowMenuToggle
          label={name}
          icon="tune"
          iconSize="lg"
          size="sm"
          className="agm-inline-menu-toggle"
          aria-describedby={describedBy}
        />
      }
      items={POLICIES.map((value) => (
        <MenuButtonItem
          key={value}
          isDanger={value === "delete"}
          description={meaning(value)}
          onClick={() => choose(value)}
        >
          {label(value, isVolumeGroup, someReused)}
        </MenuButtonItem>
      ))}
    />
  );
}
