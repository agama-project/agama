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
 * Helper function for ensuring a good value for SelectorTable#selected prop
 *
 * It logs information to console.error if given value does not match
 * expectations.
 *
 * @param {*} selected - The value to check.
 * @param {boolean} allowMultiple - Whether the returned collection can have
 *   more than one item
 * @return {Array} The original collection if it match the expectations or a new
 *   one that might be based on it or simply be empty.
 */
const sanitizeSelected = (selected, allowMultiple) => {
  if (!Array.isArray(selected)) {
    console.error("`selected` prop must be an array. Ignoring given value", selected);
    return [];
  }

  if (!allowMultiple && selected.length > 1) {
    console.error(
      "`selected` prop can only have more than one item if selector `isMultiple`. " +
        "Using only the first element"
    );

    return [selected[0]];
  }

  return selected;
};

/**
 * Build a expandable table with selectable items
 * @component
 *
 * @note It only accepts one nesting level.
 *
 * @param {object} props
 * @param {SelectorTableColumn[]} props.columns - Collection of objects defining columns.
 * @param {object[]} props.items - Collection of items to be rendered.
 * @param {string} [props.itemIdKey="name"] - The key for retrieving the item id.
 * @param {(item: object) => Array<object>} [props.itemChildren=() =>[]] - Lookup method to retrieve children from given item.
 * @param {boolean} [props.isMultiple=false] - Whether multiple selection is allowed.
 * @param {string[]} [props.initialExpandedItems=[]] - Ids of initially expanded items.
 * @param {string[]} [props.selected=[]] - Collection of selected items.
 * @param {(selection: Array<object>) => void} [props.onSelectionCallback=noop] - Callback to be triggered when selection changes.
 * @param {object} [props.tableProps] - Props for {@link https://www.patternfly.org/components/table/#table PF/Table}.
 */
export default function SelectorTable({
  columns = [],
  items = [],
  itemIdKey = "id",
  itemChildren = () => [],
  isMultiple = false,
  initialExpandedItems = [],
  selected = [],
  onSelectionChange,
  ...tableProps
}) {
  const [expandedItems, setExpandedItems] = useState(initialExpandedItems);
  const selectedItems = sanitizeSelected(selected, isMultiple);
  const isItemExpanded = (itemKey) => expandedItems.includes(itemKey);
  const isItemSelected = (item) => selectedItems.includes(item);
  const toggleExpanded = (itemKey) => {
    if (isItemExpanded(itemKey)) {
      setExpandedItems(expandedItems.filter(key => key !== itemKey));
    } else {
      setExpandedItems([...expandedItems, itemKey]);
    }
  };

  const updateSelection = (item) => {
    if (!isMultiple) {
      onSelectionChange([item]);
      return;
    }

    if (isItemSelected(item)) {
      onSelectionChange(selectedItems.filter(i => i !== item));
    } else {
      onSelectionChange([...selectedItems, item]);
    }
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
    <Table data-type="agama/expandable-selector" {...tableProps}>
      <TableHeader columns={columns} />
      <TableBody />
    </Table>
  );
}
