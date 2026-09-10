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
import { Table, Tbody, Td, Th, Thead, Tr } from "@patternfly/react-table";
import { Stack, StackItem } from "@patternfly/react-core";
import a11yStyles from "@patternfly/react-styles/css/utilities/Accessibility/accessibility";
import Text from "~/components/core/Text";
import SpaceDecision from "~/components/storage/storage-page/SpaceDecision";
import { outcomeOf } from "~/components/storage/shared/consequences";
import { useDevicesManager } from "~/components/storage/shared/use-devices-manager";
import { baseName, deviceSize } from "~/components/storage/utils";
import { _, TranslatedString } from "~/i18n";
import type { Outcome } from "~/components/storage/shared/consequences";
import type { Entry } from "~/components/storage/device-sheet/entry";
import type { SheetEntry } from "~/components/storage/shared/use-sheet";
import type { Storage as System } from "~/model/system";

/**
 * What becomes of one thing already on the device, in the reader's words.
 *
 * Said as what will happen rather than as the name of a policy: "Deleted" is
 * something a reader can check against what they meant, where "delete" is the
 * setting that produced it.
 */
function outcomeLabel(outcome: Outcome): TranslatedString {
  switch (outcome) {
    case "deleted":
      // TRANSLATORS: what the installation does to something already on the
      // disk: removes it, and everything on it.
      return _("Deleted");
    case "formatted":
      // TRANSLATORS: what the installation does to something already on the
      // disk: keeps the partition and empties it.
      return _("Emptied and reused");
    case "shrunk":
      // TRANSLATORS: what the installation does to something already on the
      // disk: makes it smaller, keeping what is on it.
      return _("Made smaller");
    case "kept":
      // TRANSLATORS: what the installation does to something already on the
      // disk: nothing at all.
      return _("Kept as it is");
  }
}

/** What is on the device now, whatever the entry calls its parts. */
function existing(entry: Entry): System.Device[] {
  return entry.isVolumeGroup ? entry.device?.logicalVolumes || [] : entry.device?.partitions || [];
}

export type CurrentContentSectionProps = {
  entry: Entry;
  /** Where the entry is written, which is what the space decision acts on. */
  subject: SheetEntry;
};

/**
 * What is on the device today, and what the installation will do to it.
 *
 * The one view where a reader can see the whole answer partition by partition
 * rather than as a summary, which is what the fourth space option means when it
 * says the decision is taken one by one.
 *
 * The decision sits above the table it governs, so the reader sees the column
 * beside it change as they take it. It is offered only on a device with a space
 * decision to take: a volume group's contents answer to the group, and an entry
 * with nothing on it has no question to answer.
 */
export default function CurrentContentSection({
  entry,
  subject,
}: CurrentContentSectionProps): React.ReactNode {
  const manager = useDevicesManager();
  const parts = existing(entry);

  return (
    <Stack hasGutter>
      <StackItem>
        <Text textStyle={["fontSizeSm", "textColorSubtle"]}>
          {/* TRANSLATORS: says what this view of a device holds: what was on it
              before the installation was planned. */}
          {_("Already here")}
        </Text>
      </StackItem>
      {/* Compared here rather than through a name of its own: it is what tells
          the type of entry apart as well as what decides the offer. */}
      {subject.collection !== "volumeGroups" && parts.length > 0 && (
        <StackItem>
          <SpaceDecision collection={subject.collection} index={subject.index} />
        </StackItem>
      )}
      {parts.length === 0 && (
        <StackItem>
          <Text textStyle="textColorSubtle">
            {/* TRANSLATORS: said of a device the installation found empty. */}
            {_("There is nothing on this device.")}
          </Text>
        </StackItem>
      )}
      {parts.length > 0 && (
        <StackItem>
          <Table
            role="table"
            gridBreakPoint=""
            variant="compact"
            // TRANSLATORS: names the list of what is on a device already.
            aria-label={_("Current content")}
          >
            <Thead className={a11yStyles.screenReader}>
              <Tr>
                <Th>{_("Device")}</Th>
                <Th>{_("Size")}</Th>
                <Th>{_("Actions")}</Th>
              </Tr>
            </Thead>
            <Tbody>
              {parts.map((part) => (
                <Tr key={part.sid}>
                  <Th scope="row">
                    {baseName(part.name)}
                    {part.block?.systems?.length > 0 && (
                      <span className="agm-entries-table__facts">
                        {" "}
                        {part.block.systems.join(", ")}
                      </span>
                    )}
                  </Th>
                  <Td>{part.block?.size !== undefined && deviceSize(part.block.size)}</Td>
                  <Td>{outcomeLabel(outcomeOf(manager, part))}</Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        </StackItem>
      )}
    </Stack>
  );
}
