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
import { Divider, Flex, FlexItem } from "@patternfly/react-core";
import spacingStyles from "@patternfly/react-styles/css/utilities/Spacing/spacing";
import Link from "~/components/core/Link";
import { STORAGE as PATHS } from "~/routes/paths";
import { generateEncodedPath } from "~/utils";
import { _ } from "~/i18n";
import type { Entry } from "~/components/storage/device-details/entry";
import type { DetailsSubject } from "~/components/storage/shared/use-device-details";

export type PlannedActionsProps = {
  entry: Entry;
  /** Where the entry is in the storage configuration, used to add its parts. */
  subject: DetailsSubject;
  /** Additional actions, shown right after the one for adding an item. */
  extraActions?: React.ReactNode;
};

/**
 * The line of actions on what the user planned for a device: adding a
 * partition or logical volume and, for a disk with something planned, moving
 * the plan to another device. A divider above it marks where reading ends and
 * acting starts.
 */
export default function PlannedActions({ entry, subject, extraActions }: PlannedActionsProps) {
  const isVolumeGroup = entry.isVolumeGroup;

  /* The forms address a volume group by its place in the configuration, as
     they address a disk. */
  const addPath = isVolumeGroup
    ? generateEncodedPath(PATHS.volumeGroup.logicalVolume.add, { id: String(subject.index) })
    : generateEncodedPath(PATHS.addPartition, {
        collection: subject.collection,
        index: String(subject.index),
      });

  /* TRANSLATORS: adds one more thing for the new system to an entry of the
     installation. "Partition" rather than "volume": what this adds to a disk is
     a partition, and volume is the word the logical ones own. */
  const addLabel = isVolumeGroup ? _("Add logical volume") : _("Add partition");

  return (
    <Flex
      direction={{ default: "column" }}
      gap={{ default: "gapMd" }}
      className={spacingStyles.mtSm}
    >
      <Divider />
      {/* Moving the plan elsewhere sits at the far end: it acts on the whole
          device, and keeps apart from adding to it. */}
      <Flex
        gap={{ default: "gapLg" }}
        flexWrap={{ default: "wrap" }}
        alignItems={{ default: "alignItemsCenter" }}
      >
        <FlexItem>
          {/* A link, since it leads to a form. */}
          <Link to={addPath} keepQuery variant="link" isInline>
            {addLabel}
          </Link>
        </FlexItem>
        {extraActions && <FlexItem>{extraActions}</FlexItem>}
      </Flex>
    </Flex>
  );
}
