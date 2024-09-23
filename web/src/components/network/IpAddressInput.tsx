/*
 * Copyright (c) [2022-2024] SUSE LLC
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
import { isValidIp } from "~/utils/network";
import { TextInput, TextInputProps, ValidatedOptions } from "@patternfly/react-core";
import { _ } from "~/i18n";

/**
 * Returns the validation state for given value
 */
const validationState = (value?: string): keyof typeof ValidatedOptions =>
  !value || value === "" || isValidIp(value) ? "default" : "error";

const IpAddressInput = ({
  label = _("IP Address"),
  onError = () => null,
  ...props
}: TextInputProps & { defaultValue?: string }) => {
  const [state, setState] = useState(validationState(props.defaultValue));

  return (
    <TextInput
      aria-label={label}
      // FIXME: avoid using this placeholder as label technique
      placeholder={label}
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

export default IpAddressInput;
