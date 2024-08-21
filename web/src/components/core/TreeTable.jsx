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

// @ts-check

import React, { useEffect, useState } from "react";
import { Table, Thead, Tr, Th, Tbody, Td, TreeRowWrapper } from "@patternfly/react-table";

/**
 * @typedef {import("@patternfly/react-table").TableProps} TableProps
 */

/**
 * @typedef {object} TreeTableColumn
 * @property {string} name
 * @property {(object) => React.ReactNode} value
 * @property {string} [classNames]
 */

/**
 * @typedef {object} TreeTableBaseProps
 * @property {TreeTableColumn[]} columns=[]
 * @property {object[]} items=[]
 * @property {object[]} [expandedItems=[]]
 * @property {(any) => array} [itemChildren]
 * @property {(any) => string} [rowClassNames]
 */

/**
 * Table built on top of PF/Table
 * @component
 *
 * FIXME: omitting `ref` here to avoid a TypeScript error but keep component as
 * typed as possible. Further investigation is needed.
 *
 * @typedef {TreeTableBaseProps & Omit<TableProps, "isTreeTable" | "ref">} TreeTableProps
 *
 * @param {TreeTableProps} props
 */
export default function TreeTable({
  columns = [],
  items = [],
  itemChildren = () => [],
  expandedItems = [],
  rowClassNames = () => "",
  ...tableProps
}) {
  const [expanded, setExpanded] = useState(expandedItems);

  useEffect(() => {
    setExpanded(expandedItems);
  }, [expandedItems, setExpanded]);

  const isExpanded = (item) => expanded.includes(item);

  const toggle = (item) => {
    if (isExpanded(item)) {
      setExpanded(expanded.filter((d) => d !== item));
    } else {
      setExpanded([...expanded, item]);
    }
  };

  const renderColumns = (item, treeRow) => {
    return columns.map((c, cIdx) => {
      const props = {
        dataLabel: c.name,
        className: c.classNames,
      };

      if (cIdx === 0) props.treeRow = treeRow;

      return (
        <Td key={cIdx} {...props}>
          {c.value(item)}
        </Td>
      );
    });
  };

  const renderRows = (items, level, hidden = false) => {
    if (items?.length <= 0) return;

    return items.map((item, itemIdx) => {
      const children = itemChildren(item);
      const expanded = isExpanded(item);

      const treeRow = {
        onCollapse: () => toggle(item),
        props: {
          isExpanded: expanded,
          isDetailsExpanded: true,
          isHidden: hidden,
          "aria-level": level,
          "aria-posinset": itemIdx + 1,
          "aria-setsize": children?.length || 0,
        },
      };

      const rowProps = {
        row: { props: treeRow.props },
        className: rowClassNames(item),
      };

      return (
        <React.Fragment key={itemIdx}>
          <TreeRowWrapper {...rowProps}>{renderColumns(item, treeRow)}</TreeRowWrapper>
          {renderRows(children, level + 1, !expanded)}
        </React.Fragment>
      );
    });
  };

  return (
    <Table variant="compact" {...tableProps} isTreeTable data-type="agama/tree-table">
      <Thead noWrap>
        <Tr>
          {columns.map((c, i) => (
            <Th key={i} className={c.classNames}>
              {c.name}
            </Th>
          ))}
        </Tr>
      </Thead>
      <Tbody>{renderRows(items, 1)}</Tbody>
    </Table>
  );
}
