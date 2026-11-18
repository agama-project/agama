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
import { useDeviceDetails } from "~/components/storage/shared/use-device-details";
import { columnName } from "~/components/storage/entries-table/columns";
import type { DetailsSubject } from "~/components/storage/shared/use-device-details";

export type EntryRowProps = {
  /** What the entry is called, as the page names things: `sda`, `system`. */
  name: React.ReactNode;
  /** How big it is, read on the name's own line. */
  size?: string;
  /** What it is, under the name: its model or its kind. */
  description?: string;
  /** What it is for, in the words the panel marks it with. */
  marks?: string[];
  /** What the new system uses it for, one value per line. */
  usedFor: React.ReactNode[];
  /**
   * Whether nothing is planned here, so the installation leaves the entry out.
   * The whole row reads quieter then, as the absence it is.
   */
  isIdle?: boolean;
  /** What happens to what it holds today. */
  existingData: React.ReactNode;
  /** The menu of what can be done to this entry. */
  menu: React.ReactNode;
  /** Where this entry is written, which is how the panel is opened on it. */
  subject: DetailsSubject;
};

/**
 * One entry of the configuration, as a row of the list.
 */
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
  const { subject: open } = useDeviceDetails();
  const isOpen =
    open !== null && open.collection === subject.collection && open.index === subject.index;

  return (
    <Tr
      className={css("agm-entries-table__row", isIdle && "agm-entries-table__row--idle")}
      isRowSelected={isOpen}
    >
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
        <Stack>
          {usedFor.map((line, index) => (
            <StackItem key={index}>{line}</StackItem>
          ))}
        </Stack>
      </Td>
      <Td dataLabel={columnName("existingData")}>{existingData}</Td>
      <Td isActionCell dataLabel={columnName("actions")}>
        {menu}
      </Td>
    </Tr>
  );
}
