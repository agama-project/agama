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

import React from "react";

const defaultRenderLabel = (option) => option?.label;

/**
 * Renders given options as a segmented control
 * @component
 *
 * @param {object} props
 * @param {object[]} props.options=[] - A collection of object.
 * @param {string} [props.optionIdKey="id"] - The key to look for the option id.
 * @param {(object) => React.ReactElement} [props.renderLabel=(object) => string] - The method for rendering the option label.
 * @param {(object) => object} [props.onClick] - The callback triggered when user clicks an option.
 * @param {object} [props.selected] - The selected option
 */
export default function SegmentedControl({
  options = [],
  optionIdKey = "id",
  renderLabel = defaultRenderLabel,
  onClick = () => {},
  selected,
}) {
  return (
    <div data-type="agama/segmented-control">
      <ul>
        { options.map((option, idx) => {
          const optionId = option[optionIdKey];

          return (
            <li key={optionId || idx}>
              <button
                aria-current={option === selected}
                onClick={() => onClick(option)}
              >
                {renderLabel(option)}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
