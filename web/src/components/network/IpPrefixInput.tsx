/*
 * Copyright (c) [2022-2024] SUSE LLC
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
import { isValidIpPrefix } from "~/utils/network";
import { TextInput, TextInputProps, ValidatedOptions } from "@patternfly/react-core";
import { _ } from "~/i18n";

/**
 * Returns the validation state for given value
 */
const validationState = (value?: string | number): keyof typeof ValidatedOptions =>
  !value || value === "" || isValidIpPrefix(value) ? "default" : "error";

const IpPrefixInput = ({
  label = _("Ip prefix or netmask"),
  onError = () => null,
  ...props
}: Omit<TextInputProps, "defaultValue"> & { defaultValue?: string | number }) => {
  const [state, setState] = useState(validationState(props.defaultValue));

  return (
    <TextInput
      // FIXME: avoid using this placeholder as label technique
      placeholder={label}
      aria-label={label}
      validated={ValidatedOptions[state]}
      onFocus={() => setState("default")}
      onBlur={(e) => {
        const nextState = validationState(e.target.value);
        nextState === "error" && onError(e.target.value);
        setState(nextState);
      }}
      {...props}
    />
  );
};

export default IpPrefixInput;
