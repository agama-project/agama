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

/** The group order: from what is defined down to the hardware it is defined on. */
const TYPE_ORDER: DetailsCollection[] = ["volumeGroups", "mdRaids", "drives"];

type Row = {
  subject: DetailsSubject;
  /** Set for a volume group. */
  group?: ConfigModel.VolumeGroup;
  /** Set for a disk or a RAID. */
  deviceName?: string;
};

function rowsOf(config: ConfigModel.Config | null): Row[] {
  const groups: Row[] = (config?.volumeGroups || []).map((group, index) => ({
    subject: { collection: "volumeGroups", index },
    group,
  }));
  const partitionables = (collection: "mdRaids" | "drives"): Row[] =>
    (config?.[collection] || []).map((device, index) => ({
      subject: { collection, index },
      deviceName: device.name,
    }));

  return [...groups, ...partitionables("mdRaids"), ...partitionables("drives")];
}

/** The title of a group of rows. */
function groupTitle(collection: DetailsCollection, count: number): TranslatedString {
  switch (collection) {
    case "volumeGroups":
      return n_("LVM volume group", "LVM volume groups", count);
    case "mdRaids":
      return n_("RAID device", "RAID devices", count);
    case "drives":
      // TRANSLATORS: heads the disks the installation uses
      return n_("Used disk", "Used disks", count);
  }
}

export type EntriesTableProps = {
  /** The heading level of the group titles. */
  groupHeadingLevel?: TitleProps["headingLevel"];
};

/**
 * The table of storage entries: disks, RAID devices and volume groups, grouped
 * by kind when there is more than one kind.
 *
 * It opts out of two PatternFly defaults: the grid role, since it is a table to
 * read, and stacking rows on narrow screens, which drops the table semantics.
 * Instead, it scrolls sideways in a region named after the table, which is a
 * Tab stop only while it scrolls, so keyboard users can scroll it.
 */
export default function EntriesTable({ groupHeadingLevel }: EntriesTableProps): React.ReactNode {
  const config = useConfigModel();
  const captionId = useId();
  const [box, setBox] = useState<HTMLDivElement | null>(null);
  const scrolls = useScrollsSideways(box);

  const rows = rowsOf(config);
  if (!rows.length) return null;

  const groups = TYPE_ORDER.map((collection) => ({
    collection,
    rows: rows.filter((row) => row.subject.collection === collection),
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
    /* The scroll box: a table scrolling by itself would confuse some screen
       readers. */
    <div
      ref={setBox}
      className="agm-entries-table"
      role="region"
      aria-labelledby={captionId}
      tabIndex={scrolls ? 0 : undefined}
    >
      <Table role="table" gridBreakPoint="" variant="compact">
        {/* A plain caption, since the PatternFly one rejects the id the
            region points at. */}
        <caption id={captionId} className={a11yStyles.screenReader}>
          {/* TRANSLATORS: names the table of disks, RAID devices and volume groups the installation uses */}
          {_("Devices of the installation")}
        </caption>
        <Thead>
          {/* Wrapped, since PatternFly makes truncated headers a Tab stop. */}
          <Tr>
            <Th modifier="wrap">{columnName("device")}</Th>
            <Th modifier="wrap">{columnName("usedFor")}</Th>
            <Th modifier="wrap">{columnName("existingData")}</Th>
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
