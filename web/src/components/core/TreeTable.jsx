/*
 * Copyright (c) [2024] SUSE LLC
 *
 * All Rights Reserved.
 *
 * This program is free software; you can redistribute it and/or modify it
 * under the terms of version 2 of the GNU General Public License as published
 * by the Free Software Foundation.
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
import { Table, Thead, Tr, Th, Tbody, Td, TreeRowWrapper } from '@patternfly/react-table';

/**
 * Table built on top of PF/Table
 * @component
 *
 * @param {object} props
 */
export default function TreeTable({
  columns = [],
  items = [],
  itemChildren = () => [],
  rowClassNames = () => ""
}) {
  const renderColumns = (item, treeRow) => {
    return columns.map((c, cIdx) => {
      const props = { dataLabel: c.title };

      if (cIdx === 0) props.treeRow = treeRow;

      return (
        // FIXME: using an array below becasue for some reason React is
        // complaining about
        // Objects are not valid as a React child (found: object with keys {title}). If you meant to render a collection of children, use an array instead.
        // when rendering the first column using the treeRow prop
        // Checking the PF/Table code might help to understand what is going on
        // there
        <Td key={cIdx} {...props}>{[c.content(item)]}</Td>
      );
    });
  };

  const renderRows = (items, level) => {
    if (!items?.length > 0) return;

    return (
      items.map((item, itemIdx) => {
        const children = itemChildren(item);

        const treeRow = {
          props: {
            isExpanded: true,
            isDetailsExpanded: true,
            "aria-level": level,
            "aria-posinset": itemIdx + 1,
            "aria-setsize": children?.length || 0
          }
        };

        const rowProps = {
          row: { props: treeRow.props },
          className: rowClassNames(item)
        };

        return (
          <React.Fragment key={itemIdx}>
            <TreeRowWrapper {...rowProps}>{renderColumns(item, treeRow)}</TreeRowWrapper>
            { renderRows(children, level + 1)}
          </React.Fragment>
        );
      })
    );
  };

  return (
    <Table isTreeTable variant="compact">
      <Thead>
        <Tr>
          { columns.map((c, i) => <Th key={i}>{c.title}</Th>) }
        </Tr>
      </Thead>
      <Tbody>
        { renderRows(items, 1) }
      </Tbody>
    </Table>
  );
}
