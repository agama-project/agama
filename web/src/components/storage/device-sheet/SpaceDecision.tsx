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
function label(decision: Decision): TranslatedString {
  switch (decision) {
    case "delete":
      // TRANSLATORS: item of the "Set all to" menu, applied to every listed
      // partition or logical volume: remove them; data lost.
      return _("Delete");
    case "resizeIfNeeded":
      // TRANSLATORS: item of the "Set all to" menu, applied to every listed
      // partition or logical volume: allow making them smaller if room is
      // needed; data kept.
      return _("Shrink if needed");
    case "keep":
      // TRANSLATORS: item of the "Set all to" menu, applied to every listed
      // partition or logical volume: change nothing.
      return _("Keep");
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
      return _("Their data is lost, and the space is freed for the new system.");
    case "resizeIfNeeded":
      // TRANSLATORS: description of "Shrink if needed" in the "Set all to"
      // menu. "Their" means the listed partitions or logical volumes (must fit
      // both nouns).
      return _("Their data is kept, and some may be made smaller if room is needed.");
    case "keep":
      // TRANSLATORS: description of "Keep" in the "Set all to" menu. "Their"
      // means the listed partitions or logical volumes (must fit both nouns).
      return _("Their data is kept, and only the free space is used.");
  }
}

export type SpaceDecisionProps = {
  collection: DeviceCollection;
  index: number;
  /** The decision every part the new system does not use shares, if they share one. */
  current?: Decision;
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
export default function SpaceDecision({ collection, index, current }: SpaceDecisionProps) {
  const setSpacePolicy = useSetSpacePolicy();

  /* Choosing the decision every part already has changes nothing, so nothing
     is written. */
  const choose = (decision: Decision) => {
    if (decision !== current) setSpacePolicy(collection, index, { type: POLICY[decision] });
  };

  // TRANSLATORS: opens a menu with "Keep", "Shrink if needed" and "Delete",
  // which apply one action to every listed partition or logical volume.
  const name = _("Set all to");

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
          {label(decision)}
        </MenuButton.Item>
      ))}
    >
      {name}
    </MenuButton>
  );
}
