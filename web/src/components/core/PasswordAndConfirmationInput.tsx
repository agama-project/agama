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

import React, { useEffect, useState } from "react";
import { FormGroup } from "@patternfly/react-core";
import { FormValidationError, PasswordInput } from "~/components/core";
import { _ } from "~/i18n";

// TODO:
//  * add documentation,
//  * allow working only in uncontrolled mode if needed, and
//  * improve the showErrors thingy

type PasswordAndConfirmationInputProps = {
  inputRef?: React.RefObject<HTMLInputElement>;
  value?: string;
  showErrors?: boolean;
  isDisabled?: boolean;
  onChange?: (e: React.SyntheticEvent, v: string) => void;
  onValidation?: (r: boolean) => void;
};

const PasswordAndConfirmationInput = ({
  inputRef,
  showErrors = true,
  value,
  onChange,
  onValidation,
  isDisabled = false,
}: PasswordAndConfirmationInputProps) => {
  const passwordInput = inputRef?.current;
  const [password, setPassword] = useState<string>(value || "");
  const [confirmation, setConfirmation] = useState<string>(value || "");
  const [error, setError] = useState<string>("");

  useEffect(() => {
    if (isDisabled) setError("");
  }, [isDisabled]);

  const validate = (password: string, passwordConfirmation: string) => {
    let newError = "";
    showErrors && setError(newError);
    passwordInput?.setCustomValidity(newError);

    if (password !== passwordConfirmation) {
      newError = _("Passwords do not match");
    }

    showErrors && setError(newError);
    passwordInput?.setCustomValidity(newError);

    if (typeof onValidation === "function") {
      onValidation(newError === "");
    }
  };

  const onValueChange = (event: React.SyntheticEvent, value: string) => {
    setPassword(value);
    validate(value, confirmation);
    if (typeof onChange === "function") onChange(event, value);
  };

  const onConfirmationChange = (_: React.SyntheticEvent, confirmationValue: string) => {
    setConfirmation(confirmationValue);
    validate(password, confirmationValue);
  };

  return (
    <>
      <FormGroup fieldId="password" label={_("Password")}>
        <PasswordInput
          inputRef={inputRef}
          id="password"
          name="password"
          value={password}
          isDisabled={isDisabled}
          onChange={onValueChange}
          onBlur={() => validate(password, confirmation)}
        />
      </FormGroup>
      <FormGroup fieldId="passwordConfirmation" label={_("Password confirmation")}>
        <PasswordInput
          id="passwordConfirmation"
          name="passwordConfirmation"
          value={confirmation}
          isDisabled={isDisabled}
          onChange={onConfirmationChange}
          onBlur={() => validate(password, confirmation)}
          validated={error === "" ? "default" : "error"}
        />
        <FormValidationError message={error} />
      </FormGroup>
    </>
  );
};

export default PasswordAndConfirmationInput;
