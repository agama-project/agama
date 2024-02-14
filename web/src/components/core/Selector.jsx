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
 * @callback onSelectionChangeCallback
 * @param {Array<string>} selection - ids of selected options
 */

/**
 * Agama component for building a selector
 *
 * @example <caption>Usage example</caption>
 *   const options = [
 *     { id: "es_ES", country: "Spain", label: "Spanish" },
 *     { id: "cs_CZ", country: "Czechia", label: "Czech" },
 *     { id: "de_DE", country: "Germany", label: "German" },
 *     { id: "en_GB", country: "United Kingdom", label: "English" }
 *   ];
 *
 *   const selectedIds = ["es_ES", "en_GB"];
 *
 *   const renderFn = ({ label, country }) => <div>{label} - {country}</div>;
 *
 *   return (
 *     <Selector
 *       isMultiple
 *       aria-label="Available locales"
 *       selectedIds={selectedIds}
 *       options={options}
 *       renderOption={renderFn}
 *       onSelectionChange={(selection) => changePreferredLocales(selection)}
 *     />
 *   );
 *
 * @param {object} props - component props
 * @param {string} [props.id] - Id attribute for selector.
 * @param {boolean} [props.isMultiple=false] - Whether the selector should allow multiple selection.
 * @param {Array<object>} props.options=[] - Item objects to build options.
 * @param {function} props.renderOption=noop - Function used for rendering options.
 * @param {string} [props.optionIdKey="id"] - Key used for retrieve options id.
 * @param {Array<*>} [props.selectedIds=[]] - Identifiers for selected options.
 * @param {onSelectionChangeCallback} [props.onSelectionChange=noop] - Callback to be called when the selection changes.
 * @param {object} [props.props] - Other props sent to the internal selector <ul> component
 */
const Selector = ({
  id = crypto.randomUUID(),
  isMultiple = false,
  options = [],
  renderOption = noop,
  optionIdKey = "id",
  selectedIds = [],
  onSelectionChange = noop,
  ...props
}) => {
  const onOptionClick = (optionId) => {
    const alreadySelected = selectedIds.includes(optionId);

    if (!isMultiple) {
      !alreadySelected && onSelectionChange([optionId]);
      return;
    }

    if (alreadySelected) {
      onSelectionChange(selectedIds.filter((id) => id !== optionId));
    } else {
      onSelectionChange([...selectedIds, optionId]);
    }
  };

  return (
    <ul { ...props } id={id} data-type="agama/list" role="grid">
      { options.map(option => {
        const optionId = option[optionIdKey];
        const optionHtmlId = `${id}-option-${optionId}`;
        const isSelected = selectedIds.includes(optionId);
        const onClick = () => onOptionClick(optionId);

        return (
          <li
            key={optionId}
            id={optionHtmlId}
            role="row"
            onClick={onClick}
            aria-selected={isSelected || undefined}
          >
            <div role="gridcell">
              <input
                type={isMultiple ? "checkbox" : "radio"}
                checked={isSelected}
                onChange={onClick}
                aria-labelledby={optionHtmlId}
              />
              { renderOption(option) }
            </div>
          </li>
        );
      })}
    </ul>
  );
};

export default Selector;
