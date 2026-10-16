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
import MenuButton from "~/components/core/MenuButton";
import { useSetSpacePolicy } from "~/hooks/model/storage/config-model";
import { _, TranslatedString } from "~/i18n";
import type { ConfigModel, DeviceCollection } from "~/model/storage/config-model";
import type { Decision } from "~/components/storage/device-sheet/partition-space";

/** Safest first, so the one that loses data comes last. */
const DECISIONS: Decision[] = ["keep", "resizeIfNeeded", "delete"];

/** The device policy giving every part the same decision. */
const POLICY: Record<Decision, ConfigModel.SpacePolicy> = {
  delete: "delete",
  resizeIfNeeded: "resize",
  keep: "keep",
};

/** The same words as the Action column, since this sets that column at once. */
function label(decision: Decision, someReused: boolean): TranslatedString {
  switch (decision) {
    case "delete":
      return someReused
        ? _("Delete all partitions with no mount point")
        : _("Delete all partitions");
    case "resizeIfNeeded":
      return _("Shrink partitions if needed and possible");
    case "keep":
      return _("Keep all partitions");
  }
}

/**
 * Read under each item before it is taken, which is when it is worth knowing.
 * What it ends up doing to the device is said by the summary above the table.
 */
function meaning(decision: Decision): TranslatedString {
  switch (decision) {
    case "delete":
      // TRANSLATORS: description of "Delete" in the "Set all to" menu. "Their"
      // means the listed partitions or logical volumes (must fit both nouns).
      return _("Their data is lost and their space is freed.");
    case "resizeIfNeeded":
      // TRANSLATORS: description of "Shrink if needed" in the "Set all to"
      // menu. "Their" means the listed partitions or logical volumes (must fit
      // both nouns).
      return _("The size of some existing partitions may be reduced, keeping their data.");
    case "keep":
      // TRANSLATORS: description of "Keep" in the "Set all to" menu. "Their"
      // means the listed partitions or logical volumes (must fit both nouns).
      return _("Only the currently available space will be used for new partitions.");
  }
}

export type SpaceDecisionProps = {
  collection: DeviceCollection;
  index: number;
  /** The decision every part the new system does not use shares, if they share one. */
  current?: Decision;
  /** Whether any of the partitions or logical volumes have an assigned mount point */
  someReused?: boolean;
};

/**
 * Gives every part of a device the new system does not use the same decision
 * at once: keep, shrink if needed, or delete.
 *
 * A menu of actions, like the menu on each row of the table, offering the same
 * three decisions for all of them at once. Its items act when chosen and hold
 * no state: what each part ends up with is read in the summary and the table.
 * Parts the new system uses keep what it does with them.
 */
export default function SpaceDecision({
  collection,
  index,
  current,
  someReused,
}: SpaceDecisionProps) {
  const setSpacePolicy = useSetSpacePolicy();

  /* Choosing the decision every part already has changes nothing, so nothing
     is written. */
  const choose = (decision: Decision) => {
    if (decision !== current) setSpacePolicy(collection, index, { type: POLICY[decision] });
  };

  // TRANSLATORS: opens a menu with "Keep", "Shrink if needed" and "Delete",
  // which apply one action to every listed partition or logical volume.
  const name = _("Set all");

  return (
    <MenuButton
      menuProps={{ "aria-label": name, popperProps: { position: "end" } }}
      toggleProps={{ variant: "secondary", size: "sm" }}
      items={DECISIONS.map((decision) => (
        <MenuButton.Item
          key={decision}
          isDanger={decision === "delete"}
          description={meaning(decision)}
          onClick={() => choose(decision)}
        >
          {label(decision, someReused)}
        </MenuButton.Item>
      ))}
    >
      {name}
    </MenuButton>
  );
}
