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
import { useNavigate } from "react-router";
import { ToggleGroup, ToggleGroupItem, Tooltip } from "@patternfly/react-core";
import { STORAGE as PATHS } from "~/routes/paths";
import { generateEncodedPath } from "~/utils";
import {
  useDevice as useDeviceConfig,
  useSetSpacePolicy,
} from "~/hooks/model/storage/config-model";
import { _, TranslatedString } from "~/i18n";
import type { ConfigModel, Partitionable } from "~/model/storage/config-model";

const POLICIES: ConfigModel.SpacePolicy[] = ["delete", "resize", "keep", "custom"];

/**
 * What the plan is doing, rather than what to do.
 *
 * In a table the reader is acting and the imperative is right. Here they are
 * reading a summary, and four buttons in the imperative look like four things
 * about to happen.
 */
function label(policy: ConfigModel.SpacePolicy): TranslatedString {
  switch (policy) {
    case "delete":
      // TRANSLATORS: how the plan treats what is already on the disk: all of it goes.
      return _("Deleting everything");
    case "resize":
      // TRANSLATORS: how the plan treats what is already on the disk: it is made
      // smaller only where the installer runs short of room.
      return _("Shrinking if needed");
    case "keep":
      // TRANSLATORS: how the plan treats what is already on the disk: none of it
      // is touched.
      return _("Keeping everything");
    case "custom":
      // TRANSLATORS: how the plan treats what is already on the disk: the reader
      // decides partition by partition.
      return _("Custom");
  }
}

/** Read before the option is taken, which is when it is worth knowing. */
function meaning(policy: ConfigModel.SpacePolicy): TranslatedString {
  switch (policy) {
    case "delete":
      return _("Every existing partition is removed and its data lost.");
    case "resize":
      return _("Existing partitions are made smaller where the installer runs short of room.");
    case "keep":
      return _("Only free space and partitions you reuse are used.");
    case "custom":
      return _("Decide what happens to each partition, one by one.");
  }
}

type SpaceOptionProps = {
  policy: ConfigModel.SpacePolicy;
  isSelected: boolean;
  onChoose: (policy: ConfigModel.SpacePolicy) => void;
};

/**
 * The tooltip is addressed to the button by id rather than wrapped around it.
 * A wrapper lands between the group and its buttons and breaks the segmented
 * look, and props given to a toggle item reach that wrapper, not the button.
 */
function SpaceOption({ policy, isSelected, onChoose }: SpaceOptionProps) {
  const buttonId = React.useId();

  return (
    <>
      <ToggleGroupItem
        text={label(policy)}
        buttonId={buttonId}
        isSelected={isSelected}
        onChange={() => onChoose(policy)}
      />
      <Tooltip content={meaning(policy)} triggerRef={() => document.getElementById(buttonId)} />
    </>
  );
}

export type SpaceDecisionProps = {
  collection: Partitionable.CollectionName;
  index: number;
};

/**
 * What the installer may do with what is already on the device.
 *
 * The one decision the page makes itself. Everywhere else the summary reports
 * and the sheet does the work, but this one is read in the same breath as its
 * consequence: the sentence under it says what the plan costs, and this is what
 * changes that number.
 *
 * Four options rather than a menu. A menu hides three of the four and gives no
 * sense that a choice exists at all, while all four show the whole decision and
 * which part of it is taken. What each one means is a tooltip, so it can be
 * read before it is chosen, and it reaches the button as its description.
 *
 * Custom is not a value like the others. It says that what happens is settled
 * partition by partition, so choosing it goes to where that is settled.
 *
 * @fixme Custom leads to the space policy page for now. It becomes the device
 *  sheet, on the tab listing what is on the device, once the sheet exists.
 */
export default function SpaceDecision({ collection, index }: SpaceDecisionProps) {
  const navigate = useNavigate();
  const setSpacePolicy = useSetSpacePolicy();
  const deviceConfig = useDeviceConfig(collection, index);
  const current = deviceConfig?.spacePolicy || "keep";

  const choose = (policy: ConfigModel.SpacePolicy) => {
    if (policy === "custom") {
      navigate(generateEncodedPath(PATHS.editSpacePolicy, { collection, index: String(index) }));
      return;
    }

    setSpacePolicy(collection, index, { type: policy });
  };

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
            onChoose={choose}
          />
        ))}
      </ToggleGroup>
    </div>
  );
}
