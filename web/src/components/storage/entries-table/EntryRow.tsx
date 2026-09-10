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
import { Flex, FlexItem, Stack, StackItem } from "@patternfly/react-core";
import Icon from "~/components/layout/Icon";
import Text from "~/components/core/Text";
import SheetOpener from "~/components/storage/shared/SheetOpener";
import { useSheet } from "~/components/storage/shared/use-sheet";
import { columnName } from "~/components/storage/entries-table/columns";
import type { Consequence } from "~/components/storage/shared/consequences";
import type { SheetEntry } from "~/components/storage/shared/use-sheet";
import type { TranslatedString } from "~/i18n";

/** Marks whose meaning travels with their direction, turned to say it. */
const CONSEQUENCE_CLASS: Record<Consequence["kind"], string> = {
  destroys: "agm-entries-table__cost--destroys",
  shrinks: "agm-entries-table__cost--shrinks",
};

const CONSEQUENCE_ICON: Record<Consequence["kind"], React.ComponentProps<typeof Icon>["name"]> = {
  destroys: "error_fill",
  /* What happens to the thing itself: it is squeezed into less room, which is
     what the mark shows. Folding is what a list does, not a partition. */
  shrinks: "compress",
};

export type EntryRowProps = {
  /** What the entry is called, as the page names things: `sda`, `system`. */
  name: string;
  /** What it is, beside the name: how big, what kind, how it is partitioned. */
  description?: string;
  /** What the installer will do here, one statement per line. */
  purpose: TranslatedString[];
  /** What that costs whatever is here already. */
  consequences: Consequence[];
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
 *   consequences={[{ kind: "destroys", text: "Windows 11 will be deleted" }]}
 *   menu={<DriveMenu entry={entry} device={device} />}
 *   subject={{ collection: "drives", index: 0 }}
 * />
 */
export default function EntryRow({
  name,
  description,
  purpose,
  consequences,
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
      <Th scope="row" dataLabel={columnName("entry")}>
        {/* The name is the way in, which is the act a row teaches: what a
            reader does with a row is open it. There is no button under it
            saying so, since a button would teach a second gesture for one
            destination whatever it was called. */}
        <SheetOpener subject={subject}>
          <Text isBold>{name}</Text>
        </SheetOpener>
        {description && <span className="agm-entries-table__facts"> {description}</span>}
      </Th>
      <Td dataLabel={columnName("content")}>
        <Stack>
          {purpose.map((line) => (
            <StackItem key={line}>{line}</StackItem>
          ))}
        </Stack>
      </Td>
      <Td dataLabel={columnName("actions")}>
        <Stack>
          {consequences.map(({ kind, text }) => (
            <StackItem key={text}>
              {/* The mark carries the color and the words carry the meaning, so
                  nothing here is lost on a reader who sees neither. */}
              <Flex
                gap={{ default: "gapXs" }}
                alignItems={{ default: "alignItemsFlexStart" }}
                flexWrap={{ default: "nowrap" }}
                className={CONSEQUENCE_CLASS[kind]}
              >
                <FlexItem>
                  <Icon name={CONSEQUENCE_ICON[kind]} size="xs" aria-hidden />
                </FlexItem>
                <FlexItem>{text}</FlexItem>
              </Flex>
            </StackItem>
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
