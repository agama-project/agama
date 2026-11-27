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
import { MenuButtonItem } from "~/components/core/MenuButton";
import Icon from "~/components/layout/Icon";
import { deviceSize, isExistingBootPartition } from "~/components/storage/utils";
import { useConfigModel, useSetSpacePolicy } from "~/hooks/model/storage/config-model";
import configModel from "~/model/storage/config-model";
import { _, TranslatedString } from "~/i18n";
import type { ConfigModel, DeviceCollection } from "~/model/storage/config-model";
import type { Storage as System } from "~/model/system";

/** What the installer may do to one partition, as the configuration can say it. */
type Decision = "keep" | "resizeIfNeeded" | "delete";

/**
 * The decisions offered for a partition. The configuration can also hold a
 * target size and a conditional delete, which are not offered.
 */
const DECISIONS: Decision[] = ["delete", "resizeIfNeeded", "keep"];

/**
 * The decision a device rule gives all its partitions. Custom has none, since
 * then each partition has its own.
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

/** The menu label of a decision, as an imperative. */
function decisionLabel(decision: Decision): TranslatedString {
  switch (decision) {
    case "keep":
      // TRANSLATORS: leave an existing partition untouched
      return _("Do not modify");
    case "resizeIfNeeded":
      // TRANSLATORS: allow making an existing partition smaller if room is needed
      return _("Shrink if needed");
    case "delete":
      // TRANSLATORS: remove an existing partition
      return _("Delete");
  }
}

const DECISION_ICONS = {
  keep: "do_not_touch",
  resizeIfNeeded: "compress",
  delete: "delete_sweep",
} as const;

function meaning(decision: Decision, partition: System.Device): TranslatedString {
  switch (decision) {
    case "keep":
      return _("Data will be kept, not used by the new system.");
    case "delete":
      return sprintf(
        // TRANSLATORS: %s is a size, such as "45 GiB".
        _("Data will be lost, %s will be freed for new partitions."),
        deviceSize(partition.block?.size),
      );
  }
}

/** Whether the installer configures booting on the given device. */
function isBootDevice(
  config: ConfigModel.Config | null,
  collection: DeviceCollection,
  index: number,
): boolean {
  if (!config || !configModel.partitionable.isCollectionName(collection)) return false;

  const name = configModel.partitionable.find(config, collection, index)?.name;
  return !!name && !!configModel.boot.hasDevice(config, name);
}

/** How much shrinking a partition can free, or nothing when it cannot be shrunk. */
function recoverableBy(partition: System.Device): number | undefined {
  const shrinking = partition.block?.shrinking;
  if (shrinking?.supported !== true || !shrinking.minSize) return undefined;

  return partition.block.size - shrinking.minSize;
}

/** The first reason the system gives for not shrinking a partition, if any. */
function shrinkReason(partition: System.Device): string | undefined {
  return partition.block?.shrinking?.reasons?.[0];
}

/**
 * Why a partition cannot be shrunk: the first reason the system gives, already
 * translated, or a generic sentence when it gives none.
 */
function ShrinkRefusal({ partition }: { partition: System.Device }): React.ReactNode {
  const reasons = partition.block?.shrinking?.reasons || [];

  // TRANSLATORS: why a partition cannot be shrunk, when no reason is known
  return reasons[0] || _("This partition cannot be made smaller.");
}

/** The current decision of a partition, from its configuration entry. */
function decisionOf(entry?: ConfigModel.Partition | ConfigModel.LogicalVolume): Decision {
  if (entry?.delete) return "delete";
  if (entry?.resizeIfNeeded) return "resizeIfNeeded";
  return "keep";
}

/** The description of an option for a given partition. */
function descriptionOf(
  decision: Decision,
  partition: System.Device,
  refused: boolean,
  booting: boolean,
): React.ReactNode {
  if (refused) return <ShrinkRefusal partition={partition} />;

  if (decision === "keep" && booting && isExistingBootPartition(partition)) {
    // TRANSLATORS: explains keeping a partition the new system may need to boot
    return _("May be used to boot the new system.");
  }

  const recoverable = decision === "resizeIfNeeded" && recoverableBy(partition);
  if (recoverable) {
    return sprintf(
      // TRANSLATORS: %s is the most space shrinking can free, such as "45 GiB"
      _("Data will be kept, up to %s may be freed for new partitions."),
      deviceSize(recoverable),
    );
  }

  return meaning(decision, partition);
}

export type PartitionSpaceItemsProps = {
  /** The partition, as the system reports it. */
  partition: System.Device;
  /** All partitions on the device the decision applies to. */
  governed: System.Device[];
  /** The configuration entries of the device partitions. */
  entries: (ConfigModel.Partition | ConfigModel.LogicalVolume)[];
  /** Where the device is in the configuration. */
  collection: DeviceCollection;
  index: number;
  /** The decision of the device rule, when it has one. */
  rule?: Decision;
};

/**
 * The menu items to decide what the installer may do to a partition or a
 * logical volume. A decision is a permission: "Shrink if needed" holds even
 * when no shrinking happens.
 *
 * The decisions of all partitions are written back together, since the
 * configuration replaces the whole list. An option that cannot apply stays
 * offered, with the reason, and reachable by keyboard.
 */
function usePartitionSpaceItems({
  partition,
  governed,
  entries,
  collection,
  index,
  rule,
}: PartitionSpaceItemsProps): React.ReactNode[] {
  const setSpacePolicy = useSetSpacePolicy();
  const config = useConfigModel();
  const booting = isBootDevice(config, collection, index);

  const entryFor = (device: System.Device) => entries.find((entry) => entry.name === device.name);
  const decisionFor = (device: System.Device) => rule || decisionOf(entryFor(device));
  const canShrink = partition.block?.shrinking?.supported === true;
  /* What the menu marks as taken is what happens to the partition: shrinking
     allowed where it cannot be shrunk keeps it, and an option offered as
     impossible cannot also read as the one taken. */
  let current = decisionFor(partition);
  if (current === "resizeIfNeeded" && !canShrink) current = "keep";

  const choose = (decision: Decision) => {
    const actions = governed
      .map((device) => ({
        deviceName: device.name,
        value: device.name === partition.name ? decision : decisionFor(device),
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
        icon={<Icon size="md" name={DECISION_ICONS[decision]} />}
        isAriaDisabled={refused}
        description={descriptionOf(decision, partition, refused, booting)}
        onClick={refused ? undefined : () => choose(decision)}
      >
        {decisionLabel(decision)}
      </MenuButtonItem>
    );
  });
}

export {
  decisionOf,
  decisionUnder,
  recoverableBy,
  shrinkReason,
  ShrinkRefusal,
  usePartitionSpaceItems,
};
export type { Decision };
