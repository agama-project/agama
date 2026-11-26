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
  /** The group title, which also names the group. */
  title: React.ReactNode;
  /** The number of table columns, all spanned by the title row. */
  columnCount: number;
  /** The heading level of the title. Defaults to h2. */
  headingLevel?: TitleProps["headingLevel"];
  /**
   * Whether the title row is rendered. Render it only when the table has more
   * than one group.
   */
  isTitleShown?: boolean;
}>;

/**
 * A group of table rows under an optional title row. Use one per group in
 * place of PatternFly's `Tbody`, so all groups share the table header and
 * columns.
 *
 * The title is a heading in a regular cell, labelling the group: screen reader
 * users can jump between groups by heading, and header cells spanning several
 * columns are announced inconsistently.
 *
 * Without its title, the group is still rendered, so its rows keep their place
 * and focus when the title comes and goes.
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
