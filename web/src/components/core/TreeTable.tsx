/*
 * Copyright (c) [2024] SUSE LLC
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

import React, { useEffect, useState } from "react";
import {
  Table,
  TableProps,
  Thead,
  Tr,
  Th,
  Tbody,
  Td,
  TdProps,
  TreeRowWrapper,
} from "@patternfly/react-table";
import { css } from "@patternfly/react-styles";
import { TranslatedString } from "~/i18n";
import { useElementSize } from "~/hooks/use-element-size";

/** PatternFly's grid breakpoints, in rem. */
const BREAKPOINTS = { "grid-md": 48, "grid-lg": 62, "grid-xl": 75, "grid-2xl": 90.625 };

/**
 * Stacks a tree table by the width it has rather than by the window width,
 * the way PatternFly already does for regular tables.
 */
function useContainerGridBreakPoint(
  node: HTMLElement | null,
  gridBreakPoint: TableProps["gridBreakPoint"],
): TableProps["gridBreakPoint"] {
  const { width } = useElementSize(node);
  const rem = BREAKPOINTS[gridBreakPoint ?? "grid-md"];
  if (width === undefined || rem === undefined) return gridBreakPoint;
  const px = rem * parseFloat(getComputedStyle(document.documentElement).fontSize);
  return width < px ? "grid" : "";
}

export type TreeTableColumn = {
  name: TranslatedString;
  value: (item: object) => React.ReactNode;
  classNames?: string;
};

type TreeTableProps = {
  columns: TreeTableColumn[];
  items: object[];
  expandedItems?: object[];
  /* eslint-disable @typescript-eslint/no-explicit-any */
  itemChildren?: (item: any) => any[];
  rowClassNames?: (item: object) => string;
  /**
   * Whether the cells of every row are centered vertically in it, rather than
   * placed at its top.
   *
   * Useful when some cells hold more than one line, such as a value with a note
   * under it: the single-line cells then sit beside the whole of that cell
   * instead of beside its first line only. Off by default.
   */
  hasVerticallyCenteredRows?: boolean;
} & Omit<TableProps, "isTreeTable">;

/**
 * Table built on top of PF/Table
 * @component
 */
export default function TreeTable({
  columns = [],
  items = [],
  itemChildren = () => [],
  expandedItems = [],
  rowClassNames = () => "",
  hasVerticallyCenteredRows = false,
  className,
  gridBreakPoint,
  ...tableProps
}: TreeTableProps) {
  const [wrapper, setWrapper] = useState<HTMLDivElement | null>(null);
  const breakPoint = useContainerGridBreakPoint(wrapper, gridBreakPoint);
  const [expanded, setExpanded] = useState(expandedItems);

  useEffect(() => {
    setExpanded(expandedItems);
  }, [expandedItems, setExpanded]);

  const isExpanded = (item: object) => expanded.includes(item);

  const toggle = (item: object) => {
    if (isExpanded(item)) {
      setExpanded(expanded.filter((d) => d !== item));
    } else {
      setExpanded([...expanded, item]);
    }
  };

  const renderColumns = (item: object, treeRow: TdProps["treeRow"]) => {
    return columns.map((c, cIdx) => {
      const props: TdProps = {
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

  const renderRows = (items: object[], level: number, hidden = false) => {
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
    <div ref={setWrapper}>
      <Table
        variant="compact"
        gridBreakPoint={breakPoint}
        className={css(
          className,
          hasVerticallyCenteredRows && "agm-table--vertically-centered-rows",
        )}
        {...tableProps}
        isTreeTable
        data-type="agama/tree-table"
      >
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
    </div>
  );
}
