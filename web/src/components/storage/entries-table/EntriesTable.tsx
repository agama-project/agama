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
import { Table, Tbody, Th, Tr } from "@patternfly/react-table";
import DriveRow from "~/components/storage/entries-table/DriveRow";
import VolumeGroupRow from "~/components/storage/entries-table/VolumeGroupRow";
import { useConfigModel } from "~/hooks/model/storage/config-model";
import { _, TranslatedString } from "~/i18n";

/** Where an entry is written in the configuration, which is also what it is. */
type Category = "volumeGroups" | "mdRaids" | "drives";

/**
 * Read as a list rather than as two special cases, so that adding a kind of
 * entry is a line here. RAID has a category today with nothing to put in it on
 * most machines, and multi-device Btrfs will want one next.
 *
 * The order is the one the configuration is already built in, from what is
 * defined down to the hardware it is defined on. It was always there and
 * nothing said so, which left a reader with a pile rather than an arrangement.
 */
const CATEGORIES: Category[] = ["volumeGroups", "mdRaids", "drives"];

function categoryTitle(category: Category): TranslatedString {
  switch (category) {
    case "volumeGroups":
      // TRANSLATORS: heads the LVM volume groups in the list of what the
      // installation is made of.
      return _("Volume groups");
    case "mdRaids":
      // TRANSLATORS: heads the software RAID devices in the list of what the
      // installation is made of.
      return _("RAID devices");
    case "drives":
      // TRANSLATORS: heads the disks in the list of what the installation is
      // made of.
      return _("Disks");
  }
}

/**
 * What the configuration is made of, under the summary of what it does.
 *
 * A table rather than a run of blocks. Entries are read by comparing them, and
 * columns only line up when one element owns them, which is also what lets a
 * screen reader say which entry and which column every cell belongs to.
 *
 * Each category is a body of its own, headed by a row naming it. That name is a
 * header cell scoped to the rowgroup rather than a heading above the table:
 * scoping is what ties the rows under it to the name for a reader who never
 * sees the arrangement, and a styled heading outside the table ties nothing to
 * anything.
 *
 * Two of PatternFly's defaults are turned off rather than accepted, and both
 * would be quiet failures:
 *
 * - It calls itself a grid, which announces an interactive widget with a
 *   keyboard model of its own. This is something to read.
 * - It stacks each row into a block below a breakpoint, which leaves the rows
 *   and cells `display: grid`, and an element laid out that way loses the role
 *   its element gave it. Only the table and the bodies are told what they are
 *   in so many words, so the grouping this list is arranged around would go
 *   exactly where the window is tightest and the arrangement matters most.
 *   The table keeps its width instead and scrolls inside its own box.
 */
export default function EntriesTable(): React.ReactNode {
  const config = useConfigModel();

  const groups = CATEGORIES.map((category) => ({
    category,
    entries: config?.[category] || [],
  })).filter((group) => group.entries.length > 0);

  if (!groups.length) return null;

  return (
    <div className="agm-entries-table">
      <Table
        role="table"
        gridBreakPoint=""
        variant="compact"
        // TRANSLATORS: names the list of everything the installation is made of.
        aria-label={_("Configured devices")}
      >
        {groups.map(({ category, entries }) => (
          <Tbody key={category}>
            <Tr className="agm-entries-table__category">
              <Th scope="rowgroup">{categoryTitle(category)}</Th>
            </Tr>
            {entries.map((entry) =>
              category === "volumeGroups" ? (
                <VolumeGroupRow key={entry.vgName} vgName={entry.vgName} />
              ) : (
                <DriveRow key={entry.name} name={entry.name} />
              ),
            )}
          </Tbody>
        ))}
      </Table>
    </div>
  );
}
