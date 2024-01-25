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
import React from 'react';
import { noop } from '~/utils';

/**
 * Convenient component for letting the consumer build the selector options
 */
const Option = ({ children }) => children;

/**
 * Internal component for building the selector options
 *
 * FIXME: check if the used aria-labelledby is the way to go for making the
 * <input /> component accessible.
 */
const Item = ({ id, type, isSelected = false, onClick, children }) => {
  const whenClicked = () => onClick(id);
  const rowId = `item-${id}`;

  return (
    <li
      id={rowId}
      role="row"
      onClick={whenClicked}
      aria-selected={isSelected || undefined}
    >
      <div role="gridcell">
        <input
          type={type}
          checked={isSelected}
          onChange={whenClicked}
          aria-labelledby={rowId}
        />
        { children }
      </div>
    </li>
  );
};

/**
 * @callback onSelectionChangeCallback
 * @param {Array<string>} selection - ids of selected options
 */

/**
 * Agama component for building a selector
 *
 * @example <caption>Usage example</caption>
 *   <Selector
 *     isMultiple
 *     aria-label="Available locales"
 *     selectedIds={["es_ES", "en_GB"]}
 *     onSelectionChange={(selection) => changePreferredLocales(selection)}
 *   >
 *     <Selector.Option id={"es_ES"}>Spanish - Spain</Selector.Option>
 *     <Selector.Option id={"cs_CZ"}>Czech - Czechia</Selector.Option>
 *     <Selector.Option id={"de_DE"}>German - Germany</Selector.Option>
 *     <Selector.Option id={"en_GB"}>English - United Kingdom</Selector.Option>
 *   </Selector>
 *
 *   NOTE: using Children API to allow sending "rich content" as option children
 *   directly with JSX. But most probably this will be changed to use a
 *   item / renderItem props combination or similar to avoid both, using the
 *   Children API and iterating collections twice (one in the component mounting
 *   the selector and another here)
 *
 * @param {object} props - component props
 * @param {Array<*>} [props.selectedIds=[]] - Identifiers for selected options.
 * @param {boolean} [props.isMultiple=false] - Whether the selector should allow multiple selection.
 * @param {onSelectionChangeCallback} [props.onSelectionChange=noop] - Callback to be called when the selection changes.
 * @param {React.ReactNode} props.children - Selector options
 * @param {object} [props.props] - Other props sent to the internal selector <ul> component
 */
const Selector = ({
  selectedIds = [],
  isMultiple = false,
  onSelectionChange = noop,
  children,
  ...props
}) => {
  const selectionWidget = isMultiple ? "checkbox" : "radio";

  const onItemClick = (itemId) => {
    const alreadySelected = selectedIds.includes(itemId);

    if (!isMultiple) {
      !alreadySelected && onSelectionChange([itemId]);
      return;
    }

    if (alreadySelected) {
      onSelectionChange(selectedIds.filter((id) => id !== itemId));
    } else {
      onSelectionChange([...selectedIds, itemId]);
    }
  };

  return (
    <ul { ...props } data-type="agama/list" role="grid">
      { React.Children.map(children, (child) => {
        if (React.isValidElement(child)) {
          const { id, children } = child.props;

          return (
            <Item
              id={id}
              key={id}
              type={selectionWidget}
              isSelected={selectedIds.includes(id)}
              onClick={onItemClick}
            >
              {children}
            </Item>
          );
        }
      })}
    </ul>
  );
};

Selector.Option = Option;

export default Selector;
