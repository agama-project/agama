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
import { Td, Th, Tr } from "@patternfly/react-table";
import { Label, Stack, StackItem } from "@patternfly/react-core";
import textStyles from "@patternfly/react-styles/css/utilities/Text/text";
import Text from "~/components/core/Text";
import { useSheet } from "~/components/storage/shared/use-sheet";
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
  actions,
  menu,
  subject,
}: EntryRowProps): React.ReactNode {
  const { openSheet } = useSheet();

  return (
    /* A click anywhere on the row opens it. A convenience for a mouse with no
       keyboard equivalent of its own, which is only acceptable because the name
       inside it is a link that does the same thing and is where the keyboard
       lands. */
    <Tr className="agm-entries-table__row" onClick={() => openSheet(subject)}>
      <Th scope="row" modifier="fitContent" dataLabel={columnName("entry")}>
        <Stack>
          <StackItem>
            {/* The name is the way in, which is the act a row teaches: what a
                reader does with a row is open it. There is no button under it
                saying so, since a button would teach a second gesture for one
                destination whatever it was called. */}
            <Text isBold>{name}</Text>
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
      {/* The menu is not the row: opening a menu on a row that opens on click
          would open both. */}
      <Td isActionCell onClick={(event) => event.stopPropagation()}>
        {menu}
      </Td>
    </Tr>
  );
}
