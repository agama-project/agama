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
import RowMenuToggle from "~/components/core/RowMenuToggle";
import { useSetSpacePolicy } from "~/hooks/model/storage/config-model";
import { _, TranslatedString } from "~/i18n";
import Icon from "~/components/layout/Icon";
import type { ConfigModel, DeviceCollection } from "~/model/storage/config-model";

const POLICIES: ConfigModel.SpacePolicy[] = ["delete", "resize", "keep"];

const ICONS = { delete: "delete_sweep", resize: "compress", keep: "do_not_touch" } as const;

/** The title of each item. */
function label(
  policy: ConfigModel.SpacePolicy,
  isVolumeGroup: boolean,
  someReused: boolean,
): TranslatedString {
  switch (policy) {
    case "delete":
      if (someReused) {
        return isVolumeGroup
          ? _("Delete all logical volumes with no mount point")
          : _("Delete all partitions with no mount point");
      }
      return isVolumeGroup ? _("Delete all logical volumes") : _("Delete all partitions");
    case "resize":
      return isVolumeGroup
        ? _("Shrink logical volumes if needed and possible")
        : _("Shrink partitions if needed and possible");
    case "keep":
      return isVolumeGroup ? _("Do not modify logical volumes") : _("Do not modify partitions");
  }
}

/** The description of each item. */
function meaning(policy: ConfigModel.SpacePolicy, isVg: boolean): TranslatedString {
  switch (policy) {
    case "delete":
      // TRANSLATORS: description of "Delete all partitions". "Their" means the partitions or
      // logical volumes (must fit both nouns).
      return _("Their data will be lost and their space will be freed.");
    case "resize":
      return isVg
        ? // TRANSLATORS: description of "Shrink volume groups if needed and possible".
          _("The size of some existing volumes may be reduced, keeping their data.")
        : // TRANSLATORS: description of "Shrink partitions groups if needed and possible".
          _("The size of some existing partitions may be reduced, keeping their data.");
    case "keep":
      return isVg
        ? // TRANSLATORS: description of "Do not modify logical volumes".
          _("Only the currently available space will be used for new volumes.")
        : // TRANSLATORS: description of "Do not modify partitions".
          _("Only the currently available space will be used for new partitions.");
  }
}

export type SpaceDecisionProps = {
  collection: DeviceCollection;
  index: number;
  /** What the device allows its partitions today. */
  policy: ConfigModel.SpacePolicy;
  /** Whether any partition or logical volume has a mount point. */
  someReused?: boolean;
  /** Id of the element saying what happens to the partitions. */
  describedBy?: string;
};

/**
 * A menu giving the same action to every partition or logical volume the new
 * system does not use: keep, shrink if needed and possible, or delete. Its
 * items act at once and none is marked as checked: the sentence beside it and
 * the table say the result.
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

  /* Choosing the current policy changes nothing. */
  const choose = (next: ConfigModel.SpacePolicy) => {
    if (next !== policy) setSpacePolicy(collection, index, { type: next });
  };

  const name = isVolumeGroup
    ? _("Actions for all logical volumes")
    : _("Actions for all partitions");

  return (
    <MenuButton
      menuProps={{ "aria-label": name, popperProps: { position: "end" } }}
      customToggle={
        <RowMenuToggle
          label={name}
          icon="home_storage_gear"
          hasTooltip
          size="sm"
          className="agm-inline-menu-toggle"
          aria-describedby={describedBy}
        />
      }
      items={POLICIES.map((value) => (
        <MenuButtonItem
          key={value}
          icon={<Icon size="md" name={ICONS[value]} />}
          description={meaning(value, isVolumeGroup)}
          onClick={() => choose(value)}
        >
          {label(value, isVolumeGroup, someReused)}
        </MenuButtonItem>
      ))}
    />
  );
}
