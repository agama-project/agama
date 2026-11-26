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
import { css } from "@patternfly/react-styles";
import textStyles from "@patternfly/react-styles/css/utilities/Text/text";
import Text from "~/components/core/Text";
import CellValues from "~/components/storage/entries-table/CellValues";
import { useDeviceDetails } from "~/components/storage/shared/use-device-details";
import { columnName } from "~/components/storage/entries-table/columns";
import type { DetailsSubject } from "~/components/storage/shared/use-device-details";

export type EntryRowProps = {
  /** The entry name, such as `sda` or `system`. */
  name: React.ReactNode;
  /** The entry size. */
  size?: string;
  /** A line under the name, such as the model of a disk. */
  description?: string;
  /** Short labels next to the name. */
  marks?: string[];
  /** What the new system uses the entry for. */
  usedFor: React.ReactNode[];
  /** Whether nothing is planned on the entry, which dims the row. */
  isIdle?: boolean;
  /** What happens to the existing data. */
  existingData: React.ReactNode;
  /** The entry menu. */
  menu: React.ReactNode;
  /** Where the entry is in the configuration. */
  subject: DetailsSubject;
};

/** A row of the storage entries table. */
export default function EntryRow({
  name,
  size,
  description,
  marks = [],
  usedFor,
  isIdle = false,
  existingData,
  menu,
  subject,
}: EntryRowProps): React.ReactNode {
  const { subject: open, keyOf } = useDeviceDetails();
  const isOpen =
    open !== null && open.collection === subject.collection && open.index === subject.index;

  return (
    <Tr className={css(isIdle && "agm-entries-table__row--idle")} isRowSelected={isOpen}>
      <Th scope="row" dataLabel={columnName("device")}>
        <Stack>
          <StackItem>
            <Text isBold>{name}</Text>
            {size && <> · {size}</>}
            {marks.map((mark) => (
              <React.Fragment key={mark}>
                {" "}
                <Label isCompact className={textStyles.fontSizeXs}>
                  {mark}
                </Label>
              </React.Fragment>
            ))}
          </StackItem>
          {description && <StackItem className="agm-row-note">{description}</StackItem>}
        </Stack>
      </Th>
      <Td dataLabel={columnName("usedFor")}>
        <CellValues values={usedFor} />
      </Td>
      <Td dataLabel={columnName("existingData")}>{existingData}</Td>
      {/* Lets the panel return focus to this menu when it closes. */}
      <Td isActionCell dataLabel={columnName("actions")} data-entry-menu={keyOf(subject)}>
        {menu}
      </Td>
    </Tr>
  );
}
