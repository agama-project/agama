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
import { Table, Tbody, Th, Thead, Tr } from "@patternfly/react-table";
import { columnName } from "~/components/storage/entries-table/columns";
import DriveRow from "~/components/storage/entries-table/DriveRow";
import VolumeGroupRow from "~/components/storage/entries-table/VolumeGroupRow";
import { baseName } from "~/components/storage/utils";
import Icon from "~/components/layout/Icon";
import type { IconProps } from "~/components/layout/Icon";
import { useGroupedTable } from "~/components/storage/storage-page/playground-switches";
import { useConfigModel } from "~/hooks/model/storage/config-model";
import { _, n_ } from "~/i18n";
import type { TranslatedString } from "~/i18n";
import type { ThProps } from "@patternfly/react-table";
import type { ConfigModel } from "~/model/storage/config-model";
import type {
  DetailsCollection,
  DetailsSubject,
} from "~/components/storage/shared/use-device-details";

/**
 * The order of the rows until sorted by device, which is the one the
 * configuration is built in: from what is defined down to the hardware it is
 * defined on.
 */
const TYPE_ORDER: DetailsCollection[] = ["volumeGroups", "mdRaids", "drives"];

/** The sortable column, by its position in the header. */
const DEVICE_COLUMN = 0;

type SortBy = { index: number; direction: "asc" | "desc" };

type Row = {
  subject: DetailsSubject;
  /** What the device column shows and sorts by. */
  name: string;
  /** Set for a volume group, whose row reads the group itself. */
  group?: ConfigModel.VolumeGroup;
  /** Set for a disk or a RAID, as the model spells its name. */
  deviceName?: string;
};

function rowsOf(config: ConfigModel.Config | null): Row[] {
  const groups: Row[] = (config?.volumeGroups || []).map((group, index) => ({
    subject: { collection: "volumeGroups", index },
    name: group.vgName,
    group,
  }));
  const partitionables = (collection: "mdRaids" | "drives"): Row[] =>
    (config?.[collection] || []).map((device, index) => ({
      subject: { collection, index },
      name: baseName(device.name),
      deviceName: device.name,
    }));

  return [...groups, ...partitionables("mdRaids"), ...partitionables("drives")];
}

/**
 * The mark beside a group's title, the same one the device panel uses for
 * that kind: what the title says, recognized before it is read.
 */
const GROUP_ICON: Record<DetailsCollection, IconProps["name"]> = {
  volumeGroups: "stacks",
  mdRaids: "dns",
  drives: "hard_drive",
};

/** What a group of the table is called, by kind and by how many it holds. */
function groupTitle(collection: DetailsCollection, count: number): TranslatedString {
  switch (collection) {
    case "volumeGroups":
      // TRANSLATORS: heads the LVM volume groups in the list of what the
      // installation is made of.
      return n_("Volume group", "Volume groups", count);
    case "mdRaids":
      // TRANSLATORS: heads the software RAID devices in the list of what the
      // installation is made of.
      return n_("RAID device", "RAID devices", count);
    case "drives":
      // TRANSLATORS: heads the disks in the list of what the installation is
      // made of.
      return n_("Used disk", "Used disks", count);
  }
}

function compareRows(column: number, a: Row, b: Row): number {
  if (column === DEVICE_COLUMN) {
    return a.name.localeCompare(b.name, undefined, { numeric: true });
  }

  const byType =
    TYPE_ORDER.indexOf(a.subject.collection) - TYPE_ORDER.indexOf(b.subject.collection);
  return byType || a.subject.index - b.subject.index;
}

/**
 * What the configuration is made of, under the summary of what it does.
 *
 * A regular table, one row per entry, with the columns named in its header:
 * the device, what happens to its existing data, what the new system puts on
 * it, and the menu of actions. It starts in the configuration's order and can
 * be sorted by device name.
 *
 * Keyboard: arrow keys walk the entries, Up and Down from name to name and Left
 * and Right between a name and its menu. Every name and every menu stays a tab
 * stop.
 *
 * Two of PatternFly's defaults are turned off:
 *
 * - It calls a table a grid, which announces an interactive widget with a
 *   keyboard model of its own. This is something to read.
 * - It stacks each row into a block below a breakpoint, which drops the table
 *   semantics exactly where the window is tightest. The table keeps its width
 *   instead and scrolls inside its own box.
 */
export default function EntriesTable(): React.ReactNode {
  const config = useConfigModel();
  const list = React.useRef<HTMLDivElement>(null);
  /* Unsorted until a header is used: the rows keep the configuration's order. */
  const [sortBy, setSortBy] = React.useState<SortBy | null>(null);
  /* PLAYGROUND: the rows can be grouped by kind from the console. Grouped, a
     sort orders each group on its own and the groups keep their order. */
  const isGrouped = useGroupedTable() === "on";
  const groupId = React.useId();

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

  const rows = rowsOf(config);
  if (!rows.length) return null;

  const sorted = [...rows].sort((a, b) => {
    if (!sortBy) return compareRows(-1, a, b);
    const order = compareRows(sortBy.index, a, b);
    return sortBy.direction === "asc" ? order : -order;
  });

  const renderRow = ({ subject, group, deviceName }: Row) =>
    group ? (
      <VolumeGroupRow key={`vg-${group.vgName}`} group={group} subject={subject} />
    ) : (
      <DriveRow key={deviceName} name={deviceName} subject={subject} />
    );

  const columnCount = 4;

  /* One body per kind, in the configuration's order, each starting with a row
     group header naming it. */
  const groups = TYPE_ORDER.map((collection) => ({
    collection,
    rows: sorted.filter((row) => row.subject.collection === collection),
  })).filter(({ rows }) => rows.length > 0);

  const sortParams = (columnIndex: number): ThProps["sort"] => ({
    sortBy: sortBy ?? {},
    onSort: (_event, index, direction) => setSortBy({ index, direction }),
    columnIndex,
  });

  return (
    <div
      className={isGrouped ? "agm-entries-table agm-entries-table--grouped" : "agm-entries-table"}
      ref={list}
      onKeyDown={onKeyDown}
    >
      <Table
        role="table"
        gridBreakPoint=""
        variant="compact"
        // TRANSLATORS: names the list of the disks, RAID devices and volume
        // groups the installation is made of.
        aria-label={_("Devices of the installation")}
      >
        <Thead>
          <Tr>
            <Th sort={sortParams(DEVICE_COLUMN)}>{columnName("device")}</Th>
            <Th>{columnName("existingData")}</Th>
            <Th>{columnName("newSystem")}</Th>
            <Th screenReaderText={columnName("actions")} />
          </Tr>
        </Thead>
        {isGrouped ? (
          groups.map(({ collection, rows }) => (
            <Tbody
              key={collection}
              className="agm-entries-table__group"
              aria-labelledby={`${groupId}-${collection}`}
            >
              <Tr>
                <Th
                  id={`${groupId}-${collection}`}
                  scope="rowgroup"
                  colSpan={columnCount}
                  className="agm-entries-table__group-header"
                >
                  <span className="agm-entries-table__group-title">
                    <Icon name={GROUP_ICON[collection]} aria-hidden />
                    {groupTitle(collection, rows.length)}
                  </span>
                </Th>
              </Tr>
              {rows.map(renderRow)}
            </Tbody>
          ))
        ) : (
          <Tbody>{sorted.map(renderRow)}</Tbody>
        )}
      </Table>
    </div>
  );
}
