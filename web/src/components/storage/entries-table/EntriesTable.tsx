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

import React, { useId, useState } from "react";
import { Table, Th, Thead, Tr } from "@patternfly/react-table";
import a11yStyles from "@patternfly/react-styles/css/utilities/Accessibility/accessibility";
import TableGroup from "~/components/core/TableGroup";
import { columnName } from "~/components/storage/entries-table/columns";
import DriveRow from "~/components/storage/entries-table/DriveRow";
import VolumeGroupRow from "~/components/storage/entries-table/VolumeGroupRow";
import { baseName } from "~/components/storage/utils";
import { useConfigModel } from "~/hooks/model/storage/config-model";
import { useScrollsSideways } from "~/hooks/use-scrolls-sideways";
import { _, n_ } from "~/i18n";
import type { TitleProps } from "@patternfly/react-core";
import type { TranslatedString } from "~/i18n";
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

/** What a group of the table is called, by kind and by how many it holds. */
function groupTitle(collection: DetailsCollection, count: number): TranslatedString {
  switch (collection) {
    case "volumeGroups":
      // TRANSLATORS: heads the LVM volume groups in the list of what the
      // installation is made of.
      return n_("LVM volume group", "LVM volume groups", count);
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

export type EntriesTableProps = {
  /** The level of the headings naming each group of rows. */
  groupHeadingLevel?: TitleProps["headingLevel"];
};

/**
 * What the configuration is made of, under the summary of what it does.
 *
 * A regular table, one row per entry, with the columns named in its header:
 * the device, what the new system uses it for, what happens to its existing
 * data, and the menu of actions. It starts in the configuration's order and can
 * be sorted by device name.
 *
 * Two of PatternFly's defaults are turned off:
 *
 * - It calls a table a grid, which announces an interactive widget with a
 *   keyboard model of its own. This is something to read.
 * - It stacks each row into a block below a breakpoint, which drops the table
 *   semantics exactly where the window is tightest. The table keeps its width
 *   instead and scrolls inside its own box.
 *
 * While that box scrolls, it is a named region and a Tab stop of its own, so a
 * keyboard reader can bring the hidden columns into view with the arrow keys.
 * Tabbing between the row menus alone would scroll straight to the last
 * column, past the ones in between, which hold only text. Once the table fits,
 * the box is neither: a stop that scrolls nothing only lengthens the way.
 */
export default function EntriesTable({ groupHeadingLevel }: EntriesTableProps): React.ReactNode {
  const config = useConfigModel();
  const captionId = useId();
  const [box, setBox] = useState<HTMLDivElement | null>(null);
  const scrolls = useScrollsSideways(box);
  /* Unsorted until a header is used. */
  const sortBy = null;

  const rows = rowsOf(config);
  if (!rows.length) return null;

  const sorted = [...rows].sort((a, b) => {
    if (!sortBy) return compareRows(-1, a, b);
    const order = compareRows(sortBy.index, a, b);
    return sortBy.direction === "asc" ? order : -order;
  });

  /* One group per kind, in the configuration's order, titled only when there
     is more than one kind. */
  const groups = TYPE_ORDER.map((collection) => ({
    collection,
    rows: sorted.filter((row) => row.subject.collection === collection),
  })).filter(({ rows }) => rows.length > 0);
  const isGrouped = groups.length > 1;

  const renderRow = ({ subject, group, deviceName }: Row) =>
    group ? (
      <VolumeGroupRow
        key={`vg-${group.vgName}`}
        group={group}
        subject={subject}
        isGrouped={isGrouped}
      />
    ) : (
      <DriveRow key={deviceName} name={deviceName} subject={subject} />
    );

  const columnCount = 4;

  return (
    /* Keep this wrapper, and its class here rather than on the table: it lets
       the table scroll sideways on narrow screens. A table cannot scroll by
       itself, and making it scroll would break how some screen readers read
       it. */
    <div
      ref={setBox}
      className="agm-entries-table"
      {...(scrolls && { role: "region", "aria-labelledby": captionId, tabIndex: 0 })}
    >
      <Table role="table" gridBreakPoint="" variant="compact">
        {/* Read rather than shown: nothing on the page heads the table, and a
            visible title would be a design change of its own. A plain caption
            rather than PatternFly's Caption, whose types reject the id the
            region needs to point at it (it passes it on all the same). */}
        <caption id={captionId} className={a11yStyles.screenReader}>
          {/* TRANSLATORS: names the list of the disks, RAID devices and volume
              groups the installation is made of. */}
          {_("Devices of the installation")}
        </caption>
        <Thead>
          <Tr>
            <Th>{columnName("device")}</Th>
            <Th>{columnName("usedFor")}</Th>
            <Th>{columnName("existingData")}</Th>
            <Th screenReaderText={columnName("actions")} />
          </Tr>
        </Thead>
        {groups.map(({ collection, rows }) => (
          <TableGroup
            key={collection}
            title={groupTitle(collection, rows.length)}
            columnCount={columnCount}
            headingLevel={groupHeadingLevel}
            isTitleShown={isGrouped}
          >
            {rows.map(renderRow)}
          </TableGroup>
        ))}
      </Table>
    </div>
  );
}
