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

// @ts-check

import React, { useEffect, useState } from "react";
import { FormGroup } from "@patternfly/react-core";
import { FormValidationError, PasswordInput } from "~/components/core";
import { _ } from "~/i18n";

// TODO: improve the component to allow working only in uncontrlled mode if
// needed.
// TODO: improve the showErrors thingy
const PasswordAndConfirmationInput = ({
  inputRef,
  showErrors = true,
  value,
  onChange,
  onValidation,
  isDisabled = false,
}) => {
  const passwordInput = inputRef?.current;
  const [password, setPassword] = useState(value || "");
  const [confirmation, setConfirmation] = useState(value || "");
  const [error, setError] = useState("");

  useEffect(() => {
    if (isDisabled) setError("");
  }, [isDisabled]);

  const validate = (password, passwordConfirmation) => {
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

  const onValueChange = (event, value) => {
    setPassword(value);
    validate(value, confirmation);
    if (typeof onChange === "function") onChange(event, value);
  };

  const onConfirmationChange = (_, confirmationValue) => {
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
