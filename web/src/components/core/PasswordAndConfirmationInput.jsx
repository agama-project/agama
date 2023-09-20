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

import React, { useState } from "react";
import { FormGroup } from "@patternfly/react-core";
import { FormValidationError, PasswordInput } from "~/components/core";
import { _ } from "~/i18n";

const PasswordAndConfirmationInput = ({ value, onChange, onValidation, isDisabled }) => {
  const [confirmation, setConfirmation] = useState(value || "");
  const [error, setError] = useState("");

  const validate = (password, passwordConfirmation) => {
    let newError = "";

    if (password !== passwordConfirmation) {
      newError = _("Passwords do not match");
    }

    setError(newError);
    if (typeof onValidation === "function") {
      onValidation(newError === "");
    }
  };

  const onValueChange = (event, value) => {
    validate(value, confirmation);
    if (typeof onChange === "function") onChange(event, value);
  };

  const onConfirmationChange = (_, confirmationValue) => {
    setConfirmation(confirmationValue);
    validate(value, confirmationValue);
  };

  return (
    <>
      <FormGroup fieldId="password" label={_("Password")}>
        <PasswordInput
          id="password"
          name="password"
          aria-label={_("User password")}
          value={value}
          isDisabled={isDisabled}
          onChange={onValueChange}
          onBlur={() => validate(value, confirmation)}
        />
      </FormGroup>
      <FormGroup
        fieldId="passwordConfirmation"
        label={_("Password confirmation")}
      >
        <PasswordInput
          id="passwordConfirmation"
          name="passwordConfirmation"
          aria-label={_("User password confirmation")}
          value={confirmation}
          isDisabled={isDisabled}
          onChange={onConfirmationChange}
          onBlur={() => validate(value, confirmation)}
          validated={error === "" ? "default" : "error"}
        />
        <FormValidationError message={error} />
      </FormGroup>
    </>
  );
};

export default PasswordAndConfirmationInput;
