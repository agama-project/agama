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
import { Link } from "react-router";
import { Td, Th, Tr } from "@patternfly/react-table";
import { Label, Stack, StackItem } from "@patternfly/react-core";
import { css } from "@patternfly/react-styles";
import tableStyles from "@patternfly/react-styles/css/components/Table/table";
import textStyles from "@patternfly/react-styles/css/utilities/Text/text";
import Text from "~/components/core/Text";
import { useSheet, SHEET_ID } from "~/components/storage/shared/use-sheet";
import { columnName } from "~/components/storage/entries-table/columns";
import type { SheetEntry } from "~/components/storage/shared/use-sheet";
import type { TranslatedString } from "~/i18n";

export type EntryRowProps = {
  /** What the entry is called, as the page names things: `sda`, `system`. */
  name: React.ReactNode;
  /** How big it is, read on the name's own line. */
  size?: string;
  /** What it is, under the name: its model or its kind. */
  description?: string;
  /** What it is for, in the words the panel marks it with. */
  marks?: string[];
  /** What the installer will do here, one statement per line. */
  purpose: TranslatedString[];
  /**
   * Whether nothing is planned here, so the installation leaves the entry out.
   * The whole row reads quieter then, as the absence it is.
   */
  isIdle?: boolean;
  /** What is going to be done to create this or make space. */
  actions: TranslatedString[];
  /** The menu of what can be done to this entry. */
  menu: React.ReactNode;
  /** Where this entry is written, which is how the sheet is opened on it. */
  subject: SheetEntry;
};

/**
 * One entry of the configuration, as a row of the list.
 *
 * Three answers, one per column, so that a reader compares eight devices by
 * going down a column rather than by reading eight paragraphs: what this entry
 * is, what the installer will do with it, and what that costs.
 *
 * The name heads the row rather than sitting in a cell of it, so that a screen
 * reader reading any other cell says which entry it belongs to first. What the
 * entry is sits under the name, smaller, so the first column is only as wide as
 * a name and leaves the room to the two columns a reader compares. The size
 * stays beside the name: it is short, and it is what a reader tells two disks
 * of the same model apart by. What is on
 * the device today is not repeated here: whoever picked the device saw it while
 * choosing, and anyone else finds it in the sheet, which opens from the name.
 *
 * Clicking anywhere in the row opens the entry, except in the menu cell, which
 * opens nothing so that a click meant for the menu cannot open the sheet. This
 * goes against the advice of not making a row clickable when it holds a second
 * control (https://adrianroselli.com/2023/11/dont-turn-a-table-into-an-aria-grid-just-for-a-clickable-row.html);
 * the dead menu cell is what makes it acceptable. The cost: text in the row
 * cannot be selected with the mouse.
 *
 * A row that costs nothing leaves the last column empty. It once said "Nothing
 * planned" there, borrowed from the column before it, which made a device that
 * destroys nothing look like a device nobody had configured.
 *
 * @example
 * <EntryRow
 *   name="sda"
 *   size="60 GiB"
 *   description="Samsung SSD 980 PRO 2TB"
 *   purpose={[_("Host LVM and boot")]}
 *   actions={[_("Windows 11 will be deleted")]}
 *   menu={<DriveMenu entry={entry} device={device} />}
 *   subject={{ collection: "drives", index: 0 }}
 * />
 */
export default function EntryRow({
  name,
  size,
  description,
  marks = [],
  purpose,
  isIdle = false,
  actions,
  menu,
  subject,
}: EntryRowProps): React.ReactNode {
  const { subject: open, addressOf } = useSheet();
  const isOpen =
    open !== null && open.collection === subject.collection && open.index === subject.index;

  return (
    /* No handler of its own: the row opens because the name's link is
       stretched over it, so mouse, keyboard and screen reader all meet the
       same control. PatternFly's clickable look comes from its class rather
       than from `isClickable`, which would also make the row itself a focus
       stop with no role and handle keys meant for the menu. */
    <Tr
      className={css(
        "agm-entries-table__row",
        tableStyles.modifiers.clickable,
        isIdle && "agm-entries-table__row--idle",
      )}
      isRowSelected={isOpen}
    >
      <Th scope="row" dataLabel={columnName("entry")}>
        <Stack>
          <StackItem>
            {/* A plain anchor rather than the page's Link: that one is a
                PatternFly button, which is positioned and draws its border
                with the same pseudo-element the stretch needs. */}
            <Link
              to={addressOf(subject)}
              replace
              aria-controls={SHEET_ID}
              aria-current={isOpen || undefined}
              className="agm-entries-table__opener"
              /* So the list around it can walk its entries with the arrow keys
                 without knowing how any of them is drawn. */
              data-entry-name=""
            >
              <Text isBold>{name}</Text>
            </Link>
            {size && <> · {size}</>}
            {/* The same words the panel puts beside the same name, so the row a
                reader opened and the panel that opens carry one vocabulary. */}
            {marks.map((mark) => (
              <React.Fragment key={mark}>
                {" "}
                <Label isCompact className={textStyles.fontSizeXs}>
                  {mark}
                </Label>
              </React.Fragment>
            ))}
          </StackItem>
          {description && <StackItem className="agm-entries-table__facts">{description}</StackItem>}
        </Stack>
      </Th>
      <Td dataLabel={columnName("actions")}>
        <Stack>
          {actions.map((line) => (
            <StackItem key={line}>{line}</StackItem>
          ))}
        </Stack>
      </Td>
      <Td dataLabel={columnName("content")}>
        <Stack>
          {purpose.map((line) => (
            <StackItem key={line}>{line}</StackItem>
          ))}
        </Stack>
      </Td>
      {/* Above the stretched link: a click anywhere in this cell opens
          nothing but the menu. */}
      <Td isActionCell className="agm-entries-table__menu" data-entry-menu="">
        {menu}
      </Td>
    </Tr>
  );
}
