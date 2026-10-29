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
import { Flex } from "@patternfly/react-core";
import { Table, Tbody, Td, Th, Thead, Tr } from "@patternfly/react-table";
import a11yStyles from "@patternfly/react-styles/css/utilities/Accessibility/accessibility";
import { columnName } from "~/components/storage/entries-table/columns";
import DriveRow from "~/components/storage/entries-table/DriveRow";
import VolumeGroupRow from "~/components/storage/entries-table/VolumeGroupRow";
import ChangeInstallationDisk from "~/components/storage/storage-page/ChangeInstallationDisk";
import { useConfigModel } from "~/hooks/model/storage/config-model";
import { useCandidateDrives } from "~/hooks/model/system/storage";
import configModel from "~/model/storage/config-model";
import { _, n_, TranslatedString } from "~/i18n";

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

function categoryTitle(category: Category, entries: object[]): TranslatedString {
  switch (category) {
    case "volumeGroups":
      // TRANSLATORS: heads the LVM volume groups in the list of what the
      // installation is made of.
      return n_("Volume group", "Volume groups", entries.length);
    case "mdRaids":
      // TRANSLATORS: heads the software RAID devices in the list of what the
      // installation is made of.
      return n_("RAID device", "RAID devices", entries.length);
    case "drives":
      // TRANSLATORS: heads the disks in the list of what the installation is
      // made of.
      return n_("Used disk", "Used disks", entries.length);
  }
}

/**
 * One category of the configuration, as a body of the list's table: a title
 * row naming it, then a row per entry.
 *
 * The title row is a plain row, not a header row. Its one cell holds the
 * category's heading and the controls acting on the whole category, such as
 * changing the installation disk. Content placed in a header cell is announced
 * with every cell that header covers, so a control there would be read out on
 * every row of the category; in a plain cell it is read once, where the
 * category starts.
 *
 * The heading is a real `<h2>`. HTML allows headings in a data cell (`<td>`
 * takes any flow content) but not in a header cell (`<th>` forbids heading
 * descendants), which is the other reason the title row is plain. The body is
 * named after the heading, so a screen reader that announces named groups says
 * which category a row belongs to when entering it.
 */
function CategoryBody({
  category,
  entries,
  actions,
  children,
}: {
  category: Category;
  entries: object[];
  /** Controls acting on the category as a whole, shown beside its heading. */
  actions?: React.ReactNode;
  children: React.ReactNode;
}): React.ReactNode {
  const headingId = React.useId();

  return (
    <Tbody aria-labelledby={headingId} className="agm-entries-table__group">
      <Tr className="agm-entries-table__title-row">
        <Td colSpan={4}>
          <Flex alignItems={{ default: "alignItemsCenter" }} gap={{ default: "gapSm" }}>
            <h2 id={headingId} className="agm-entries-table__category">
              {categoryTitle(category, entries)}
            </h2>
            {actions}
          </Flex>
        </Td>
      </Tr>
      {children}
    </Tbody>
  );
}

/**
 * What the configuration is made of, under the summary of what it does.
 *
 * One table, with a body per category (see {@link CategoryBody}). Entries are
 * read by comparing them, and a table is what lets a screen reader say which
 * entry and which column every cell belongs to. Being one table, its columns
 * line up across categories by themselves and take the width their content
 * needs: a long name or model widens its column rather than wrapping inside a
 * width fixed for every category.
 *
 * For example, with a volume group and one disk:
 *
 * ```html
 * <table aria-label="Devices of the installation">
 *   <thead class="pf-v6-screen-reader"> Device | Actions | Content | Options </thead>
 *   <tbody aria-labelledby="vgs">
 *     <tr><td colspan="4"><h2 id="vgs">Volume group</h2></td></tr>
 *     <tr><th scope="row">system</th> <td>…</td> <td>…</td> <td>⋯</td></tr>
 *   </tbody>
 *   <tbody aria-labelledby="disks">
 *     <tr><td colspan="4"><h2 id="disks">Used disk</h2> [Change…]</td></tr>
 *     <tr><th scope="row">vdd · 20 GiB</th> <td>…</td> <td>…</td> <td>⋯</td></tr>
 *   </tbody>
 * </table>
 * ```
 *
 * What readers get:
 *
 * - Keyboard: title rows are not focusable and add no tab stop. Arrow keys walk
 *   the entries as one list, Up and Down from name to name and Left and Right
 *   between a name and its menu, skipping title rows, since only entries mark
 *   their name and menu for it. Every name and every menu stays a tab stop.
 * - Screen readers: categories are headings, reachable by heading navigation.
 *   A cell of an entry is announced with its column and its entry, as in any
 *   table. Not available: moving by table from one category to the next,
 *   which the headings replace, and the category announced on every cell of an
 *   entry, which a header row scoped to its body would give but would also read
 *   out any control placed in it. Some readers announce the column names on a
 *   title row's cell, since it spans all of them, and title rows count among
 *   the rows.
 *
 * Two of PatternFly's defaults are turned off rather than accepted, and both
 * would be quiet failures:
 *
 * - It calls a table a grid, which announces an interactive widget with a
 *   keyboard model of its own. This is something to read.
 * - It stacks each row into a block below a breakpoint, which leaves the rows
 *   and cells `display: grid`, and an element laid out that way loses the role
 *   its element gave it, exactly where the window is tightest. The table keeps
 *   its width instead and scrolls inside its own box.
 */
export default function EntriesTable(): React.ReactNode {
  const config = useConfigModel();
  const candidate = useCandidateDrives();
  const list = React.useRef<HTMLDivElement>(null);

  /* Arrow keys walk the entries, which is what a reader expects of a list they
     are comparing rather than reading once. Every name and every menu stays a
     tab stop, since
     this is a table to read and not a widget to operate: the arrows are a way
     of moving faster, not the only way of moving. */
  const onKeyDown = (event: React.KeyboardEvent) => {
    /* Right and left move between an entry's name and its menu. Both stay tab
       stops: this is a shortcut, not the only way to reach the menu. */
    const row = (document.activeElement as HTMLElement | null)?.closest("tr");
    if (row && (event.key === "ArrowRight" || event.key === "ArrowLeft")) {
      const name = row.querySelector<HTMLElement>("[data-entry-name]");
      const menu = row.querySelector<HTMLElement>("[data-entry-menu] button");
      const target = event.key === "ArrowRight" ? menu : name;
      const from = event.key === "ArrowRight" ? name : menu;
      if (target && from === document.activeElement) {
        event.preventDefault();
        target.focus();
      }
      return;
    }

    const names = [...(list.current?.querySelectorAll<HTMLElement>("[data-entry-name]") || [])];
    const at = names.indexOf(document.activeElement as HTMLElement);
    if (at === -1) return;

    const focusAt = (index: number) => {
      const next = names[Math.max(0, Math.min(index, names.length - 1))];
      if (!next) return;

      event.preventDefault();
      next.focus();
    };

    switch (event.key) {
      case "ArrowDown":
        return focusAt(at + 1);
      case "ArrowUp":
        return focusAt(at - 1);
      case "Home":
        return focusAt(0);
      case "End":
        return focusAt(names.length - 1);
    }
  };

  const groups = CATEGORIES.map((category) => ({
    category,
    entries: config?.[category] || [],
  })).filter((group) => group.entries.length > 0);

  if (!groups.length) return null;

  const canChangeTarget = configModel.canChangeTargetDrive(config) && candidate.length > 1;

  return (
    <div className="agm-entries-table" ref={list} onKeyDown={onKeyDown}>
      <Table
        role="table"
        gridBreakPoint=""
        variant="compact"
        // TRANSLATORS: names the list of the disks, RAID devices and volume
        // groups the installation is made of.
        aria-label={_("Devices of the installation")}
      >
        {/* Read out and not drawn. A strip of names sitting once at the top of
            a list of eight devices labels columns that have scrolled away from
            it, and every row already carries its own name. */}
        <Thead className={a11yStyles.screenReader}>
          <Tr>
            <Th>{columnName("entry")}</Th>
            <Th>{columnName("actions")}</Th>
            <Th>{columnName("content")}</Th>
            <Th>{columnName("options")}</Th>
          </Tr>
        </Thead>
        {groups.map(({ category, entries }) => (
          <CategoryBody
            key={category}
            category={category}
            entries={entries}
            actions={category === "drives" && canChangeTarget && <ChangeInstallationDisk />}
          >
            {entries.map((entry, index) =>
              category === "volumeGroups" ? (
                <VolumeGroupRow
                  key={entry.vgName}
                  group={entry}
                  subject={{ collection: category, index }}
                />
              ) : (
                <DriveRow
                  key={entry.name}
                  name={entry.name}
                  subject={{ collection: category, index }}
                />
              ),
            )}
          </CategoryBody>
        ))}
      </Table>
    </div>
  );
}
