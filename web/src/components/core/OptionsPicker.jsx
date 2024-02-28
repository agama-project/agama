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

/**
 * Wrapper for OptionsPicker options
 * @component
 *
 * @param {object} props
 * @param {string} [props.title] - Text to be used as option title
 * @param {string} [props.body] - Text to be used as option body
 * @param {boolean} [props.isSelected=false] - Whether the option should be set as select of not
 * @param {object} [props.props] - Other props sent to div#option node
 */
const Option = ({ title, body, isSelected = false, ...props }) => {
  return (
    <div
      {...props}
      role="option"
      aria-selected={isSelected}
    >
      <div><b>{title}</b></div>
      <div>{body}</div>
    </div>
  );
};

/**
 * Helper component to build rich options picker
 * @component
 *
 * @param {object} props
 * @param {string} [props.ariaLabel] - Text to be used as accessible label
 * @param {Array<Option>} props.children - A collection of Option
 * @param {object} [props.props] - Other props sent to div#listbox node
 */
const OptionsPicker = ({ "aria-label": ariaLabel, children, ...props }) => {
  return (
    <div
      {...props}
      role="listbox"
      data-type="agama/options-picker"
      aria-label={ariaLabel}
    >
      {children}
    </div>
  );
};

OptionsPicker.Option = Option;

export default OptionsPicker;
