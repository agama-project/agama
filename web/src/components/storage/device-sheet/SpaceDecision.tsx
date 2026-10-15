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
import { Flex, ToggleGroup, ToggleGroupItem, Tooltip } from "@patternfly/react-core";
import Text from "~/components/core/Text";
import { useSetSpacePolicy } from "~/hooks/model/storage/config-model";
import { _, TranslatedString } from "~/i18n";
import type { ConfigModel, DeviceCollection } from "~/model/storage/config-model";
import type { Decision } from "~/components/storage/device-sheet/partition-space";

const DECISIONS: Decision[] = ["delete", "resizeIfNeeded", "keep"];

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
      // TRANSLATORS: completes "Set all partitions to": remove them.
      return _("Delete");
    case "resizeIfNeeded":
      // TRANSLATORS: completes "Set all partitions to": allow making them
      // smaller, should the installation run short of room.
      return _("Shrink if needed");
    case "keep":
      // TRANSLATORS: completes "Set all partitions to": do nothing to them.
      return _("Keep");
  }
}

/**
 * Read before the option is taken, which is when it is worth knowing. What the
 * option ends up doing to the device is said by the summary above the table.
 */
function meaning(decision: Decision): TranslatedString {
  switch (decision) {
    case "delete":
      // TRANSLATORS: explains deleting every partition, or logical volume, the
      // new system does not use.
      return _("Their data is lost, and the space is freed for the new system.");
    case "resizeIfNeeded":
      // TRANSLATORS: explains allowing every partition, or logical volume, the
      // new system does not use to be made smaller.
      return _("Their data is kept, and some may be made smaller if room is needed.");
    case "keep":
      // TRANSLATORS: explains keeping every partition, or logical volume, the
      // new system does not use.
      return _("Their data is kept, and only the free space is used.");
  }
}

type SpaceOptionProps = {
  decision: Decision;
  isSelected: boolean;
  onChoose: (decision: Decision) => void;
};

/**
 * The tooltip is addressed to the button by id rather than wrapped around it.
 * A wrapper lands between the group and its buttons and breaks the segmented
 * look, and props given to a toggle item reach that wrapper, not the button.
 */
function SpaceOption({ decision, isSelected, onChoose }: SpaceOptionProps) {
  const buttonId = React.useId();

  return (
    <>
      <ToggleGroupItem
        text={label(decision)}
        buttonId={buttonId}
        isSelected={isSelected}
        onChange={() => onChoose(decision)}
      />
      <Tooltip content={meaning(decision)} triggerRef={() => document.getElementById(buttonId)} />
    </>
  );
}

export type SpaceDecisionProps = {
  collection: DeviceCollection;
  index: number;
  /** Whether the parts are logical volumes rather than partitions. */
  isVolumeGroup?: boolean;
  /** The decision every part the new system does not use shares, if they share one. */
  current?: Decision;
};

/**
 * Gives every part of a device the new system does not use the same decision
 * at once: delete, shrink if needed, or keep.
 *
 * A shortcut over deciding part by part, not a separate choice. When the parts
 * share a decision, that one reads pressed; when they do not, none does, and
 * pressing one gives it to all of them. Parts the new system uses keep what it
 * does with them.
 */
export default function SpaceDecision({
  collection,
  index,
  isVolumeGroup = false,
  current,
}: SpaceDecisionProps) {
  const setSpacePolicy = useSetSpacePolicy();
  const labelId = React.useId();

  /* Pressing the decision already taken changes nothing, so nothing is written. */
  const choose = (decision: Decision) => {
    if (decision !== current) setSpacePolicy(collection, index, { type: POLICY[decision] });
  };

  return (
    <Flex
      className="agm-space-decision"
      alignItems={{ default: "alignItemsCenter" }}
      gap={{ default: "gapSm" }}
    >
      <Text id={labelId}>
        {isVolumeGroup
          ? // TRANSLATORS: names the options next to it, which give every logical
            // volume of a volume group the same action at once.
            _("Set all logical volumes to")
          : // TRANSLATORS: names the options next to it, which give every
            // partition of a disk the same action at once.
            _("Set all partitions to")}
      </Text>
      <ToggleGroup isCompact aria-labelledby={labelId}>
        {DECISIONS.map((decision) => (
          <SpaceOption
            key={decision}
            decision={decision}
            isSelected={decision === current}
            onChoose={choose}
          />
        ))}
      </ToggleGroup>
    </Flex>
  );
}
