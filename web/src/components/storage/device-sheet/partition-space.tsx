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
import { sprintf } from "sprintf-js";
import { List, ListItem } from "@patternfly/react-core";
import { MenuButtonItem } from "~/components/core/MenuButton";
import { deviceSize } from "~/components/storage/utils";
import { useSetSpacePolicy } from "~/hooks/model/storage/config-model";
import { _, TranslatedString } from "~/i18n";
import type { ConfigModel, DeviceCollection } from "~/model/storage/config-model";
import type { Storage as System } from "~/model/system";

/** What the installer may do to one partition, as the configuration can say it. */
type Decision = "keep" | "resizeIfNeeded" | "delete";

/**
 * The three decisions a partition can carry.
 *
 * An explicit size to shrink to and a conditional delete are states the
 * configuration can hold, and they are still read elsewhere; neither is offered
 * here, because neither is a decision the reader can make anywhere else either.
 */
const DECISIONS: Decision[] = ["keep", "resizeIfNeeded", "delete"];

/**
 * What a device's own rule allows each of its partitions, where the rule is one
 * for the whole device.
 *
 * The three answers are the same three a partition can carry on its own, said
 * once for every part rather than part by part. Custom has no answer here: it
 * is the answer that says there is none for the device, and each part gives its
 * own.
 */
function decisionUnder(policy: ConfigModel.SpacePolicy): Decision | undefined {
  switch (policy) {
    case "delete":
      return "delete";
    case "resize":
      return "resizeIfNeeded";
    case "keep":
      return "keep";
    case "custom":
      return undefined;
  }
}

/**
 * The word for one decision, as the thing a reader asks for.
 *
 * An imperative, because this is what the menu offering it needs: a reader
 * picking "Delete" is telling the installer to. Where the same decision is only
 * being reported, the row says it as a state of affairs instead.
 */
function decisionLabel(decision: Decision): TranslatedString {
  switch (decision) {
    case "keep":
      // TRANSLATORS: offered on one partition already on a device: do nothing
      // to it.
      return _("Keep");
    case "resizeIfNeeded":
      // TRANSLATORS: offered on one partition already on a device: allow it to
      // be made smaller, should the installation run short of room.
      return _("Shrink if needed");
    case "delete":
      // TRANSLATORS: offered on one partition already on a device: remove it.
      return _("Delete");
  }
}

function meaning(decision: Decision): TranslatedString {
  switch (decision) {
    case "keep":
      // TRANSLATORS: explains keeping one partition.
      return _("Left as it is.");
    case "resizeIfNeeded":
      // TRANSLATORS: explains allowing one partition to be made smaller.
      return _("Resized only if space runs short.");
    case "delete":
      // TRANSLATORS: explains deleting one partition.
      return _("Removed, and its data lost.");
  }
}

/**
 * How much shrinking one partition can free, as the machine reports it.
 *
 * Nothing where it cannot be shrunk, which is what tells the two cases apart.
 */
function recoverableBy(partition: System.Device): number | undefined {
  const shrinking = partition.block?.shrinking;
  if (shrinking?.supported !== true || !shrinking.minSize) return undefined;

  return partition.block.size - shrinking.minSize;
}

/**
 * How much shrinking a partition can free, said as a sentence.
 *
 * "Up to": it is how far the partition can go, not how far it will. What is
 * actually done is told by the actions.
 */
function recoverableText(partition: System.Device): TranslatedString | undefined {
  const recoverable = recoverableBy(partition);
  if (recoverable === undefined) return undefined;

  // TRANSLATORS: how much room making one partition smaller can give at most.
  // %s is a size, such as "45 GiB".
  return sprintf(_("Up to %s can be freed."), deviceSize(recoverable));
}

/**
 * The first reason the machine gives for not shrinking a partition, if any.
 *
 * One reason only, whatever the machine gives, for where there is room for a
 * single line. The reasons come translated and are shown as they come.
 */
function shrinkReason(partition: System.Device): string | undefined {
  return partition.block?.shrinking?.reasons?.[0];
}

/**
 * Why a partition cannot be shrunk, in the machine's own words.
 *
 * Every reason the machine gives, since any one of them is enough to stop it
 * and a reader fixing one would otherwise meet the next only after trying. One
 * reason reads as a sentence; several as a list, so each is read as one. None
 * of it can be opened or closed: it sits in a menu, where every control added
 * is one more stop for a keyboard and one more thing to find.
 *
 * The reasons come translated and are shown as they come. Where the machine
 * gives none, a sentence of our own says so rather than leaving the reader
 * with no answer.
 */
function ShrinkRefusal({ partition }: { partition: System.Device }): React.ReactNode {
  const reasons = partition.block?.shrinking?.reasons || [];

  if (reasons.length > 1) {
    return (
      <List isPlain>
        {reasons.map((reason) => (
          <ListItem key={reason}>{reason}</ListItem>
        ))}
      </List>
    );
  }

  // TRANSLATORS: why a partition cannot be allowed to shrink, where the
  // machine says nothing more.
  return reasons[0] || _("This partition cannot be made smaller.");
}

/** The decision a partition carries today, read from its configuration entry. */
function decisionOf(entry?: ConfigModel.Partition | ConfigModel.LogicalVolume): Decision {
  if (entry?.delete) return "delete";
  if (entry?.resizeIfNeeded) return "resizeIfNeeded";
  return "keep";
}

/** What one option says about itself, on this partition. */
function descriptionOf(
  decision: Decision,
  partition: System.Device,
  refused: boolean,
): React.ReactNode {
  if (refused) return <ShrinkRefusal partition={partition} />;

  const recoverable = decision === "resizeIfNeeded" && recoverableBy(partition);
  if (recoverable) {
    return sprintf(
      // TRANSLATORS: explains allowing one partition to be made smaller, and
      // how much room that can give at most. %s is a size, such as "45 GiB".
      _("Resized only if space runs short. Up to %s can be freed."),
      deviceSize(recoverable),
    );
  }

  return meaning(decision);
}

export type PartitionSpaceItemsProps = {
  /** The partition these decide about, as the machine reports it. */
  partition: System.Device;
  /** Every partition the decision governs on this device, in the same terms. */
  governed: System.Device[];
  /** The device's configuration entries, which carry the decisions made so far. */
  entries: (ConfigModel.Partition | ConfigModel.LogicalVolume)[];
  /** Where the entry is written. */
  collection: DeviceCollection;
  index: number;
};

/**
 * What the installer may do to one partition, or to one logical volume, offered
 * where that is decided one at a time.
 *
 * Menu items rather than a control of their own, in the same menu as everything
 * else the row can be told to do. A row offering two ways in asks the reader to
 * learn which of its own things live where; and a control sitting in a column
 * of its own gives a decision already written in the row's first column a
 * second place to be read.
 *
 * Offered only under the fourth space answer, which is the answer that says the
 * parts decide. Under the other three the decision belongs to the device, and
 * is made where the device is.
 *
 * It is a permission rather than an instruction: "Shrink if needed" is the
 * whole truth about a partition the installer did not have to shrink.
 *
 * Every partition's decision is written back with the one being changed,
 * because the configuration clears them all before applying the list it is
 * given. Sending only the partition that changed would quietly undo every other
 * decision on the device.
 *
 * An option that cannot apply stays offered and says why, reachable by keyboard.
 * Shrinking always says something about this partition in particular: how much
 * it can free, or why it cannot be shrunk. It is where a reader considering it
 * decides, whatever the device's own rule is.
 */
function usePartitionSpaceItems({
  partition,
  governed,
  entries,
  collection,
  index,
}: PartitionSpaceItemsProps): React.ReactNode[] {
  const setSpacePolicy = useSetSpacePolicy();

  const entryFor = (device: System.Device) => entries.find((entry) => entry.name === device.name);
  const current = decisionOf(entryFor(partition));
  const canShrink = partition.block?.shrinking?.supported === true;

  const choose = (decision: Decision) => {
    const actions = governed
      .map((device) => ({
        deviceName: device.name,
        value: device.name === partition.name ? decision : decisionOf(entryFor(device)),
      }))
      .filter(
        (action): action is { deviceName: string; value: "delete" | "resizeIfNeeded" } =>
          action.value !== "keep",
      );

    setSpacePolicy(collection, index, { type: "custom", actions });
  };

  return DECISIONS.map((decision) => {
    const refused = decision === "resizeIfNeeded" && !canShrink;

    return (
      <MenuButtonItem
        key={decision}
        isSelected={decision === current}
        isDanger={decision === "delete"}
        isAriaDisabled={refused}
        description={descriptionOf(decision, partition, refused)}
        onClick={refused ? undefined : () => choose(decision)}
      >
        {decisionLabel(decision)}
      </MenuButtonItem>
    );
  });
}

export {
  decisionLabel,
  decisionOf,
  decisionUnder,
  recoverableText,
  shrinkReason,
  ShrinkRefusal,
  usePartitionSpaceItems,
};
export type { Decision };
