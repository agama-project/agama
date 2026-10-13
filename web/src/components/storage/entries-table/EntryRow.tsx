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
  /** What it is, beside the name: how big, what kind, how it is partitioned. */
  description?: string[];
  /** What it is for, in the words the panel marks it with. */
  marks?: string[];
  /** What the installer will do here, one statement per line. */
  purpose: TranslatedString[];
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
 * entry is follows the name on the same line: a name on a line of its own
 * spends a whole line saying one word, and the facts beside it are read as
 * belonging to it rather than as a column of their own.
 *
 * A row that costs nothing leaves the last column empty. It once said "Nothing
 * planned" there, borrowed from the column before it, which made a device that
 * destroys nothing look like a device nobody had configured.
 *
 * @example
 * <EntryRow
 *   name="sda"
 *   description="60 GiB · Disk · GPT"
 *   purpose={[_("Host LVM and boot")]}
 *   actions={[_("Windows 11 will be deleted")]}
 *   menu={<DriveMenu entry={entry} device={device} />}
 *   subject={{ collection: "drives", index: 0 }}
 * />
 */
export default function EntryRow({
  name,
  description = [],
  marks = [],
  purpose,
  actions,
  menu,
  subject,
}: EntryRowProps): React.ReactNode {
  const { subject: open, addressOf } = useSheet();
  const isOpen =
    open !== null &&
    open !== "result" &&
    open.collection === subject.collection &&
    open.index === subject.index;

  return (
    /* No handler of its own: the row opens because the name's link is
       stretched over it, so mouse, keyboard and screen reader all meet the
       same control. PatternFly's clickable look comes from its class rather
       than from `isClickable`, which would also make the row itself a focus
       stop with no role and handle keys meant for the menu. */
    <Tr
      className={css("agm-entries-table__row", tableStyles.modifiers.clickable)}
      isRowSelected={isOpen}
    >
      <Th scope="row" dataLabel={columnName("entry")}>
        <Stack>
          <StackItem>
            {/* The name is the way in, which is the act a row teaches: what a
                reader does with a row is open it. There is no button under it
                saying so, since a button would teach a second gesture for one
                destination whatever it was called. */}
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
            {description[0] && <span className="agm-entries-table__facts"> {description[0]}</span>}
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
          <StackItem className={textStyles.fontSizeXs}>
            {description[1] && description[1]}
          </StackItem>
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
      {/* Above the stretched link, so a click on the menu is a click on the
          menu and nothing else. */}
      <Td isActionCell className="agm-entries-table__menu" data-entry-menu="">
        {menu}
      </Td>
    </Tr>
  );
}
