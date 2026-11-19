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

import React, { useId } from "react";
import { Tbody, Td, Tr } from "@patternfly/react-table";
import type { TitleProps } from "@patternfly/react-core";

export type TableGroupProps = React.PropsWithChildren<{
  /** What the group is called: the heading over its rows and its accessible name. */
  title: React.ReactNode;
  /** How many columns the table has, all spanned by the title row. */
  columnCount: number;
  /** The level of the title's heading, which the table's place in the page decides. */
  headingLevel?: TitleProps["headingLevel"];
  /**
   * Whether the title row is shown. Show it only when the table holds more
   * than one group: a single one needs no name over it.
   */
  isTitleShown?: boolean;
}>;

/**
 * A group of rows inside a table, under a title row naming it. One per group,
 * in place of PatternFly's `Tbody`, so the table keeps its own header and every
 * group lines up under the same columns.
 *
 * The title is a heading in a plain cell, not a header cell spanning the row:
 *
 * - Screen readers jump from group to group with heading navigation.
 * - Header cells spanning several columns are announced inconsistently across
 *   screen readers and browsers.
 *
 * The group itself is labelled by that heading.
 *
 * Without its title, the group is still there, so its rows keep their place,
 * and focus, when the title comes and goes.
 */
export default function TableGroup({
  title,
  columnCount,
  headingLevel: Heading = "h2",
  isTitleShown = true,
  children,
}: TableGroupProps) {
  const titleId = useId();

  return (
    <Tbody className="agm-table-group" aria-labelledby={isTitleShown ? titleId : undefined}>
      {isTitleShown && (
        <Tr className="agm-table-group__title-row">
          <Td colSpan={columnCount} className="agm-table-group__title-cell">
            <Heading id={titleId} className="agm-table-group__title">
              {title}
            </Heading>
          </Td>
        </Tr>
      )}
      {children}
    </Tbody>
  );
}
