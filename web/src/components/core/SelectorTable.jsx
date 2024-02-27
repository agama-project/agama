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

import React, { useState } from "react";
import { Table, Thead, Tr, Th, Tbody, Td, ExpandableRowContent } from "@patternfly/react-table";
import { findContent } from "~/utils";

/**
 * An object for sharing data across nested maps
 *
 * Since function arguments are always passed by value, an object passed by
 * sharing is needed for sharing data that might be mutated from different
 * places, as it is the case of the rowIndex prop here.
 *
 * @see https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Functions#passing_arguments
 *
 * @typedef {object} SharedData
 * @property {number} rowIndex - The current row index, to be incremented each time a table row is generated.
 */

/**
 * @typedef {object} SelectorTableColumn
 * @property {string} name - The column header text
 * @property {(object) => React.Element} value - A function receiving
 *   the item to work with and returning the column value.
 */

/**
 * Internal component for building the table header
 *
 * @param {object} props
 * @param {SelectorTableColumn[]} props.columns
 */
const TableHeader = ({ columns }) => (
  <Thead>
    <Tr>
      <Th />
      <Th />
      { columns?.map((c, i) => <Th key={i}>{c.name}</Th>) }
    </Tr>
  </Thead>
);

/**
 * Build a expandable table with selectable items
 * @component
 *
 * @note It only accepts one nesting level.
 *
 * @param {object} props
 * @param {SelectorTableColumn[]} props.columns
 * @param {object[]} props.items
 * @param {string} [props.itemIdKey="name"] - The key for retrieving the item id
 * @param {string[]} [props.itemChildrenPaths=[]] - The paths to look for item children
 * @param {boolean} [props.isMultiple=false] - Whether multiple selection is allowed
 * @param {string[]} [props.selected=[]] - Ids of selected items
 * @param {string[]} [props.initialExpandedItems=[]] - Ids of initially expanded items
 * @param {object} [props.tableProps] - Props for {@link https://www.patternfly.org/components/table/#table PF/Table}
 */
export default function SelectorTable({
  columns = [],
  items = [],
  itemIdKey = "id",
  itemChildrenPaths = [],
  isMultiple = false,
  initialExpandedItems = [],
  selected = [],
  ...tableProps
}) {
  const [selectedItems, setSelectedItems] = useState(selected);
  const [expandedItems, setExpandedItems] = useState(initialExpandedItems);

  const isItemExpanded = (itemKey) => expandedItems.includes(itemKey);
  const isItemSelected = (item) => selectedItems.includes(item);
  const toggleExpanded = (itemKey) => {
    const nextState = isItemExpanded(itemKey) ? expandedItems.filter(key => key !== itemKey) : [...expandedItems, itemKey];
    setExpandedItems(nextState);
  };

  const updateSelection = (item) => {
    if (!isMultiple) {
      setSelectedItems([item]);
      return;
    }

    let nextSelection;
    if (isItemSelected(item)) {
      nextSelection = selectedItems.filter(i => i !== item);
    } else {
      nextSelection = [...selectedItems, item];
    }
    setSelectedItems(nextSelection);
  };

  /**
   * Render method for building the markup for an item child
   *
   * @param {object} item - The child to be rendered
   * @param {boolean} isExpanded - Whether the child should be shown or not
   * @param {SharedData} sharedData - An object holding shared data
   */
  const renderItemChild = (item, isExpanded, sharedData) => {
    const rowIndex = sharedData.rowIndex++;

    const selectProps = {
      rowIndex,
      onSelect: () => updateSelection(item),
      isSelected: isItemSelected(item),
      variant: isMultiple ? "checkbox" : "radio"
    };

    return (
      <Tr key={rowIndex} isExpanded={isExpanded}>
        <Td />
        <Td select={selectProps} />
        { columns?.map((column, index) => (
          <Td key={index} dataLabel={column.name}>
            <ExpandableRowContent>{column.value(item)}</ExpandableRowContent>
          </Td>
        ))}
      </Tr>
    );
  };

  /**
   * Render method for building the markup for item
   *
   * @param {object} item - The item to be rendered
   * @param {SharedData} sharedData - An object holding shared data
   */
  const renderItem = (item, sharedData) => {
    const itemKey = item[itemIdKey];
    const rowIndex = sharedData.rowIndex++;
    const children = findContent({ in: item, at: itemChildrenPaths });
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
      variant: isMultiple ? "checkbox" : "radio"
    };

    const renderChildren = () => {
      if (!validChildren) return;

      return children.map(item => renderItemChild(item, isItemExpanded(itemKey), sharedData));
    };

    // TODO: Add label to Tbody?
    return (
      <Tbody key={rowIndex} isExpanded={isItemExpanded(itemKey)}>
        <Tr>
          <Td expand={expandProps} />
          <Td select={selectProps} />
          { columns?.map((column, index) => (
            <Td key={index} dataLabel={column.name}>
              {column.value(item)}
            </Td>
          ))}
        </Tr>
        { renderChildren() }
      </Tbody>
    );
  };

  // @see SharedData
  const sharedData = { rowIndex: 0 };

  const TableBody = () => items?.map(item => renderItem(item, sharedData));

  return (
    <Table {...tableProps}>
      <TableHeader columns={columns} />
      <TableBody />
    </Table>
  );
}
