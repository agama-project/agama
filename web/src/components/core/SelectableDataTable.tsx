/*
 * Copyright (c) [2024-2025] SUSE LLC
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

import React, { useState } from "react";
import {
  Table,
  TableProps,
  Thead,
  Tr,
  Th,
  Tbody,
  Td,
  ExpandableRowContent,
  RowSelectVariant,
  ThProps,
  TdProps,
} from "@patternfly/react-table";

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * An object for sharing data across nested maps
 *
 * Since function arguments are always passed by value, an object passed by
 * sharing is needed for sharing data that might be mutated from different
 * places, as it is the case of the rowIndex prop here.
 *
 * @see https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Functions#passing_arguments
 */

type SharedData = {
  rowIndex: number;
};

/**
 * Defines a column configuration for a SelectableDataTable component.
 *
 * This type is used to describe how each column should be rendered, including
 * its header, cell content, styling, and integration with its counterpart PatternFly
 * components.
 */
export type SelectableDataTableColumn = {
  /**
   * The text to display in the column header.
   *
   * @example "Name", "Status", "Created At"
   */
  name: string;

  /**
   * A function that takes a data item and returns the content to display in the
   * column's cell. This enables dynamic rendering based on the row data.
   *
   * @param item - The data object for the current row.
   * @returns A React node representing the cell content.
   *
   * @example
   * ```ts
   * value: (item) => <strong>{item.name}</strong>
   * ```
   */
  value: (item: object) => React.ReactNode;

  /**
   * A space-separated string of additional CSS class names to apply to the column's cells.
   * Useful for custom styling or conditional formatting.
   *
   * @example "text-right font-weight-bold"
   */
  classNames?: string;

  /**
   * Additional props to pass to the PatternFly `<th>` element for this column.
   *
   * Refer to the PatternFly documentation for available properties:
   * https://www.patternfly.org/components/table#th
   */
  pfThProps?: ThProps;

  /**
   * Additional props to pass to the PatternFly `<td>` element for this column's cells.
   *
   * Refer to the PatternFly documentation for available properties:
   * https://www.patternfly.org/components/table#th
   */
  pfTdProps?: TdProps;
};

/**
 * Props for the `SelectableDataTable` component.
 *
 * This component renders a data table with support for single or multiple item selection,
 * optional row expansion, and customizable rendering behavior.
 *
 * The selection API (`itemsSelected` and `onSelectionChange`) always uses arrays,
 * even in single selection mode, to maintain consistency.
 */
export type SelectableDataTableProps = {
  /**
   * Defines the columns of the table.
   *
   * Each entry describes the configuration for a single column.
   */
  columns?: SelectableDataTableColumn[];

  /**
   * Determines the selection behavior of the table.
   *
   * - `"single"`: Allows selecting only one item at a time (radio buttons).
   * - `"multiple"`: Allows selecting multiple items (checkboxes).
   */
  selectionMode?: "single" | "multiple";

  /**
   * Data items to be rendered as rows in the table.
   */
  items?: object[];

  /**
   * Key used to extract a unique identifier from each item.
   */
  itemIdKey?: string;

  /**
   * A function that returns the child items of a given item (for expandable
   * items).
   */
  itemChildren?: (item: object) => object[];

  /**
   * A function to determine if a given item is selectable.
   *
   * Return `false` to disable the selection.
   */
  itemSelectable?: (item: object) => boolean;

  /**
   * A function to add custom CSS class names to the row corresponding to a
   * given item.
   */
  itemClassNames?: (item: object) => string | undefined;

  /**
   * Array of currently selected items.
   */
  itemsSelected?: object[];

  /**
   * Keys of items that should be initially expanded (for expandable rows).
   */
  initialExpandedKeys?: any[];

  /**
   * Callback fired when the selection changes.
   *
   * Receives the updated array of selected items.
   */
  onSelectionChange?: (selection: object[]) => void;
} & TableProps;

/**
 * Internal component for building the table header
 */
const TableHeader = ({ columns }: { columns: SelectableDataTableColumn[] }) => (
  <Thead noWrap>
    <Tr>
      <Th />
      <Th />
      {columns?.map((c, i) => (
        <Th key={i} className={c.classNames}>
          {c.name}
        </Th>
      ))}
    </Tr>
  </Thead>
);

/**
 * Helper function to sanitize the `itemsSelected` prop value for the
 * `SelectableDataTable` component.
 *
 * It logs an error to the console if the provided value does not meet
 * expectations, and adjusts the selection accordingly.
 *
 * @param selection - The selection value to validate.
 * @param selectionMode - The selection mode.
 * @returns
 *   - An empty array if the input is not a valid array.
 *   - An array containing only the first item if `selectionMode` is `"single"`
 *     and multiple items are provided.
 *   - The original selection array otherwise.
 */
const sanitizeSelection = (
  selection: unknown,
  selectionMode: SelectableDataTableProps["selectionMode"],
): any[] => {
  if (!Array.isArray(selection)) {
    console.error("`itemsSelected` prop must be an array. Ignoring given value:", selection);
    return [];
  }

  if (selectionMode === "single" && selection.length > 1) {
    console.error(
      "`itemsSelected` prop cannot contain more than one item when `selectionMode` is `single`. " +
        "Using only the first element.",
    );

    return [selection[0]];
  }

  return selection;
};

/**
 * A data table component that supports single or multiple item selection.
 *
 * For consistency, the selection API (`itemsSelected` and `onSelectionChange`)
 * always uses arrays, even when `selectionMode` is set to `"single"`.
 *
 * @note It only accepts one nesting level.
 */
export default function SelectableDataTable({
  columns = [],
  selectionMode = "single",
  items = [],
  itemIdKey = "id",
  itemChildren = () => [],
  itemSelectable = () => true,
  itemClassNames = () => "",
  itemsSelected = [],
  initialExpandedKeys = [],
  onSelectionChange,
  ...tableProps
}: SelectableDataTableProps) {
  const [expandedItemsKeys, setExpandedItemsKeys] = useState(initialExpandedKeys);
  const selection = sanitizeSelection(itemsSelected, selectionMode);
  const allowMultiple = selectionMode === "multiple";
  const isItemSelected = (item: object) => {
    const selected = selection.find((selectionItem) => {
      return (
        Object.hasOwn(selectionItem, itemIdKey) && selectionItem[itemIdKey] === item[itemIdKey]
      );
    });

    return selected !== undefined || selection.includes(item);
  };
  const isItemExpanded = (key: string | number) => expandedItemsKeys.includes(key);
  const toggleExpanded = (key: string | number) => {
    if (isItemExpanded(key)) {
      setExpandedItemsKeys(expandedItemsKeys.filter((k) => k !== key));
    } else {
      setExpandedItemsKeys([...expandedItemsKeys, key]);
    }
  };

  const updateSelection = (item: object) => {
    if (!allowMultiple) {
      onSelectionChange([item]);
      return;
    }

    if (isItemSelected(item)) {
      onSelectionChange(selection.filter((i) => i !== item));
    } else {
      onSelectionChange([...selection, item]);
    }
  };

  /**
   * Render method for building the markup for an item child
   *
   * @param item - The child to be rendered
   * @param isExpanded - Whether the child should be shown or not
   * @param sharedData - An object holding shared data
   */
  const renderItemChild = (item: object, isExpanded: boolean, sharedData: SharedData) => {
    const rowIndex = sharedData.rowIndex++;

    const selectProps = {
      rowIndex,
      onSelect: () => updateSelection(item),
      isSelected: isItemSelected(item),
      variant: allowMultiple ? RowSelectVariant.checkbox : RowSelectVariant.radio,
    };

    return (
      <Tr key={rowIndex} isExpanded={isExpanded} className={itemClassNames(item)}>
        <Td />
        <Td select={itemSelectable(item) ? selectProps : undefined} />
        {columns?.map((column, index) => (
          <Td key={index} dataLabel={column.name} className={column.classNames}>
            <ExpandableRowContent>{column.value(item)}</ExpandableRowContent>
          </Td>
        ))}
      </Tr>
    );
  };

  /**
   * Render method for building the markup for item
   *
   * @param item - The item to be rendered
   * @param sharedData - An object holding shared data
   */
  const renderItem = (item: object, sharedData: SharedData) => {
    const itemKey = item[itemIdKey];
    const rowIndex = sharedData.rowIndex++;
    const children = itemChildren(item);
    const validChildren = Array.isArray(children) && children.length > 0;
    const expandProps = validChildren && {
      rowIndex,
      isExpanded: isItemExpanded(itemKey),
      onToggle: () => toggleExpanded(itemKey),
    };

    const selectProps = {
      rowIndex,
      onSelect: () => updateSelection(item),
      isSelected: isItemSelected(item),
      variant: allowMultiple ? RowSelectVariant.checkbox : RowSelectVariant.radio,
    };

    const renderChildren = () => {
      if (!validChildren) return;

      return children.map((item) => renderItemChild(item, isItemExpanded(itemKey), sharedData));
    };

    // TODO: Add label to Tbody?
    return (
      <Tbody key={rowIndex} isExpanded={isItemExpanded(itemKey)}>
        <Tr className={itemClassNames(item)}>
          <Td expand={expandProps} />
          <Td select={itemSelectable(item) ? selectProps : undefined} />
          {columns?.map((column, index) => (
            <Td key={index} dataLabel={column.name} className={column.classNames}>
              {column.value(item)}
            </Td>
          ))}
        </Tr>
        {renderChildren()}
      </Tbody>
    );
  };

  // @see SharedData
  const sharedData = { rowIndex: 0 };

  const TableBody = () => items?.map((item) => renderItem(item, sharedData));

  return (
    <Table data-type="agama/expandable-selector" {...tableProps}>
      <TableHeader columns={columns} />
      <TableBody />
    </Table>
  );
}
