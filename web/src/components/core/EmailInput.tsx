/*
 * Copyright (c) [2023] SUSE LLC
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

import React, { useEffect, useState } from "react";
import { InputGroup, TextInput, TextInputProps } from "@patternfly/react-core";
import { isEmpty, noop } from "radashi";

/**
 * Email validation.
 *
 * Code inspired by https://github.com/manishsaraan/email-validator/blob/master/index.js
 */
const validateEmail = (email: string) => {
  const regexp =
    /^[-!#$%&'*+/0-9=?A-Z^_a-z`{|}~](\.?[-!#$%&'*+/0-9=?A-Z^_a-z`{|}~])*@[a-zA-Z0-9](-*\.?[a-zA-Z0-9])*\.[a-zA-Z](-?[a-zA-Z0-9])+$/;

  const validateFormat = (email: string) => {
    const parts = email.split("@");

    return parts.length === 2 && regexp.test(email);
  };

  const validateSizes = (email: string) => {
    const [account, address] = email.split("@");

    if (account.length > 64) return false;
    if (address.length > 255) return false;

    const domainParts = address.split(".");

    if (domainParts.find((p) => p.length > 63)) return false;

    return true;
  };

  return validateFormat(email) && validateSizes(email);
};

export type EmailInputProps = TextInputProps & { onValidate?: (isValid: boolean) => void };

/**
 * Renders an email input field which validates its value.
 * @component
 *
 * @param onValidate - Callback to be called every time the input value is
 *  validated.
 * @param props - Props matching the {@link https://www.patternfly.org/components/forms/text-input PF/TextInput},
 *  except `type` and `validated` which are managed by the component.
 */
export default function EmailInput({ onValidate = noop, value, ...props }: EmailInputProps) {
  const [isValid, setIsValid] = useState(true);

  useEffect(() => {
    const isValid = typeof value === "string" && (isEmpty(value) || validateEmail(value));
    setIsValid(isValid);
    typeof onValidate === "function" && onValidate(isValid);
  }, [onValidate, value, setIsValid]);

  return (
    <InputGroup>
      <TextInput {...props} type="email" value={value} validated={isValid ? "default" : "error"} />
    </InputGroup>
  );
}
