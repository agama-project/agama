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
import { ToggleGroup, ToggleGroupItem, Tooltip } from "@patternfly/react-core";
import { useSheet } from "~/components/storage/shared/use-sheet";
import { useSpacePolicy } from "~/components/storage/shared/space-policy";
import { useDevice as useDeviceConfig } from "~/hooks/model/storage/config-model";
import { _, TranslatedString } from "~/i18n";
import configModel from "~/model/storage/config-model";
import type { ConfigModel, DeviceCollection, Partitionable } from "~/model/storage/config-model";

const POLICIES: ConfigModel.SpacePolicy[] = ["delete", "resize", "keep", "custom"];

/**
 * What the plan is doing, rather than what to do.
 *
 * In a table the reader is acting and the imperative is right. Here they are
 * reading a summary, and four buttons in the imperative look like four things
 * about to happen.
 *
 * FIXME: This should work also for logical volumes
 */
function label(policy: ConfigModel.SpacePolicy, isAssertive: boolean): TranslatedString {
  switch (policy) {
    case "delete":
      return isAssertive ? _("Delete disk content") : _("Deleting disk content");
    case "resize":
      return isAssertive ? _("Shrink existing partitions") : _("Shrinking existing partitions");
    case "keep":
      return isAssertive ? _("Keep partitions") : _("Keeping partitions");
    case "custom":
      return _("Custom");
  }
}

/**
 * Read before the option is taken, which is when it is worth knowing, and
 * again after, where the answer taken is all a reader wants.
 *
 * The device panel opens on this rather than on the list of what is on the
 * device. One sentence in both places: a summary worded one way here and
 * another way there would have a reader comparing the two to work out whether
 * they are the same decision.
 */
function meaning(policy: ConfigModel.SpacePolicy): TranslatedString {
  switch (policy) {
    case "delete":
      return _("Every existing partition will be removed and its data lost.");
    case "resize":
      return _("The size of some existing partitions may be reduced.");
    case "keep":
      return _("Only the currently available space will be used.");
    case "custom":
      return _("Decide what happens to each partition, one by one.");
  }
}

type SpaceOptionProps = {
  policy: ConfigModel.SpacePolicy;
  isSelected: boolean;
  isDisabled: boolean;
  isAssertive: boolean;
  onChoose: (policy: ConfigModel.SpacePolicy) => void;
};

/**
 * The tooltip is addressed to the button by id rather than wrapped around it.
 * A wrapper lands between the group and its buttons and breaks the segmented
 * look, and props given to a toggle item reach that wrapper, not the button.
 */
function SpaceOption({ policy, isSelected, isDisabled, isAssertive, onChoose }: SpaceOptionProps) {
  const buttonId = React.useId();

  return (
    <>
      <ToggleGroupItem
        text={label(policy, isAssertive)}
        buttonId={buttonId}
        isSelected={isSelected}
        isDisabled={isDisabled}
        onChange={() => onChoose(policy)}
      />
      <Tooltip content={meaning(policy)} triggerRef={() => document.getElementById(buttonId)} />
    </>
  );
}

export type SpaceDecisionProps = {
  collection: DeviceCollection;
  index: number;
  isAssertive?: boolean;
  onCustom?: () => void;
};

/**
 * What the installer may do with what is already on the device.
 *
 * Four options rather than a menu. A menu hides three of the four and gives no
 * sense that a choice exists at all, while all four show the whole decision and
 * which part of it is taken. What each one means is a tooltip, so it can be
 * read before it is chosen, and it reaches the button as its description.
 *
 * Custom asks for one thing more than the others. It is an answer like them,
 * but it says the answer is given part by part, so taking it also opens the
 * view where those are given. It starts with everything kept: the reader has
 * decided how to decide, not what to decide, which is why it has to be
 * remembered rather than read back. {@link useSpacePolicy} does that.
 */
export default function SpaceDecision({
  collection,
  index,
  isAssertive,
  onCustom,
}: SpaceDecisionProps) {
  const { openSheet } = useSheet();
  const deviceConfig = useDeviceConfig(collection, index);
  const { policy: current, choose: answer } = useSpacePolicy(
    collection,
    index,
    deviceConfig?.spacePolicy,
  );

  const choose = (policy: ConfigModel.SpacePolicy) => {
    answer(policy);

    /* Custom is answered like the others and then followed up: it says the
       decision is made part by part, so the reader is taken to where those are
       made: the list of what is on the device today. */
    if (policy === "custom") {
      openSheet({ collection, index });
      if (onCustom) onCustom();
    }
  };

  const reused = configModel.partitionable.isReusingPartitions(
    deviceConfig as Partitionable.Device,
  );

  return (
    <div className="agm-space-decision">
      {/* The group carries the name, since four buttons saying what each does
          still need saying what they are four of. */}
      <ToggleGroup
        isCompact
        // TRANSLATORS: names the four options below it, which say what the
        // installer is allowed to do with what is already on the disk.
        aria-label={_("Allowed changes")}
      >
        {POLICIES.map((policy) => (
          <SpaceOption
            key={policy}
            policy={policy}
            isSelected={policy === current}
            isDisabled={reused && policy !== "custom"}
            isAssertive={isAssertive}
            onChoose={choose}
          />
        ))}
      </ToggleGroup>
    </div>
  );
}

export { meaning as policyMeaning };
