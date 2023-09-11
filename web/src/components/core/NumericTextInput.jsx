/*
 * Copyright (c) [2023] SUSE LLC
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
import { TextInput } from "@patternfly/react-core";
import { noop } from "~/utils";

/**
 * Callback function for notifying a valid input change
 *
 * @callback onChangeFn
 * @param {string|number} the input value
 * @return {void}
 */

/**
 * Helper component for having an input text limited to not signed numbers
 * @component
 *
 * Based on {@link PF/TextInput https://www.patternfly.org/v4/components/text-input}
 *
 * @note It allows empty value too.
 *
 * @param {object} props
 * @param {string|number} props.value - the input value
 * @param {onChangeFn} props.onChange - the callback to be called when the entered value match the input pattern
 * @param {object} props.textInputProps - @see {@link https://www.patternfly.org/v4/components/text-input/#textinput}
 *
 * @returns {ReactComponent}
 */
export default function NumericTextInput({ value = "", onChange = noop, ...textInputProps }) {
  // NOTE: Using \d* instead of \d+ at the beginning to allow empty
  const pattern = /^\d*\.?\d*$/;

  const handleOnChange = (_, value) => {
    if (pattern.test(value)) {
      onChange(value);
    }
  };

  return (
    <TextInput { ...textInputProps } value={value} onChange={handleOnChange} />
  );
}
