/*
 * Copyright (c) [2022] SUSE LLC
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

import {
  FormGroup,
  FormSelect,
  FormSelectOption,
} from "@patternfly/react-core";

export default function DeviceSelector({ value, options, onChange }) {
  const selectorOptions = options.map(option => {
    return <FormSelectOption key={option.id} value={option.id} label={option.label} />;
  });

  return (
    <FormGroup fieldId="device" label="Device to install into">
      <FormSelect
        id="device"
        value={value}
        aria-label="Storage device selector"
        onChange={onChange}
      >
        {selectorOptions}
      </FormSelect>
    </FormGroup>
  );
}
