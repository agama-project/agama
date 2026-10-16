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
import { Table, Tbody, Th, Thead, Tr } from "@patternfly/react-table";
import a11yStyles from "@patternfly/react-styles/css/utilities/Accessibility/accessibility";
import { columnName } from "~/components/storage/entries-table/columns";
import DriveRow from "~/components/storage/entries-table/DriveRow";
import VolumeGroupRow from "~/components/storage/entries-table/VolumeGroupRow";
import ChangeInstallationDisk from "~/components/storage/storage-page/ChangeInstallationDisk";
import { useConfigModel } from "~/hooks/model/storage/config-model";
import configModel from "~/model/storage/config-model";
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
      return _("Used disks");
  }
}

/**
 * One category of the configuration: a heading naming it, then a table of its
 * entries.
 *
 * The heading names both the section and the table, so a reader moving by
 * headings, by landmarks or by tables meets the same name, written once.
 *
 * A named section is a region landmark. With every category present, that is
 * three landmarks inside the page. If that turns out to be noise when moving by
 * landmarks, the section can drop its name and the table keep it.
 */
function CategorySection({
  category,
  actions,
  children,
}: {
  category: Category;
  /** Controls acting on the category as a whole, shown beside its heading. */
  actions?: React.ReactNode;
  children: React.ReactNode;
}): React.ReactNode {
  const headingId = React.useId();

  return (
    <section aria-labelledby={headingId} className="agm-entries-table__section">
      <Flex
        className="agm-entries-table__header"
        alignItems={{ default: "alignItemsCenter" }}
        gap={{ default: "gapSm" }}
      >
        <h2 id={headingId} className="agm-entries-table__category">
          {categoryTitle(category)}
        </h2>
        {actions}
      </Flex>
      <Table role="table" gridBreakPoint="" variant="compact" aria-labelledby={headingId}>
        {/* Read out and not drawn. A strip of names sitting once at the top of
            a list of eight devices labels columns that have scrolled away from
            it, and every row already carries its own name. */}
        {/* The same widths in every category, so entries line up across the
            tables as if they were one. */}
        <colgroup>
          <col className="agm-entries-table__col--entry" />
          <col className="agm-entries-table__col--actions" />
          <col />
          <col className="agm-entries-table__col--options" />
        </colgroup>
        <Thead className={a11yStyles.screenReader}>
          <Tr>
            <Th>{columnName("entry")}</Th>
            <Th>{columnName("actions")}</Th>
            <Th>{columnName("content")}</Th>
            <Th>{columnName("options")}</Th>
          </Tr>
        </Thead>
        <Tbody>{children}</Tbody>
      </Table>
    </section>
  );
}

/**
 * What the configuration is made of, under the summary of what it does.
 *
 * A section per category, each a heading over a table of its entries. Entries
 * are read by comparing them, and a table is what lets a screen reader say
 * which entry and which column every cell belongs to.
 *
 * Each category has a table of its own rather than a body in a shared one, so
 * its name can be a real heading, and controls acting on a whole category can
 * sit beside that heading without being read out as part of every cell under
 * it. The tables share their column widths, so entries still line up from one
 * category to the next.
 *
 * Arrow keys walk the entries across every table, as one list.
 *
 * Two of PatternFly's defaults are turned off rather than accepted, and both
 * would be quiet failures:
 *
 * - It calls a table a grid, which announces an interactive widget with a
 *   keyboard model of its own. This is something to read.
 * - It stacks each row into a block below a breakpoint, which leaves the rows
 *   and cells `display: grid`, and an element laid out that way loses the role
 *   its element gave it, exactly where the window is tightest. The tables keep
 *   their width instead and scroll inside their own box.
 */
export default function EntriesTable(): React.ReactNode {
  const config = useConfigModel();
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

  const canChangeTarget = configModel.canChangeTargetDrive(config);

  return (
    <div className="agm-entries-table" ref={list} onKeyDown={onKeyDown}>
      {groups.map(({ category, entries }) => (
        <CategorySection
          key={category}
          category={category}
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
        </CategorySection>
      ))}
    </div>
  );
}
