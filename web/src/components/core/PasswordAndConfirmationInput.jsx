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
import {
  FormGroup,
  TextInput
} from "@patternfly/react-core";
import { _ } from "~/i18n";

const PasswordAndConfirmationInput = ({ value, onChange, onValidation, isDisabled, split = false }) => {
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

  const onChangeValue = (value, event) => {
    validate(value, confirmation);
    if (typeof onChange === "function") onChange(value, event);
  };

  const onChangeConfirmation = (confirmationValue) => {
    setConfirmation(confirmationValue);
    validate(value, confirmationValue);
  };

  return (
    <div className={split ? "split" : "stack"}>
      <FormGroup fieldId="password" label={_("Password")}>
        <TextInput
          id="password"
          name="password"
          type="password"
          aria-label={_("User password")}
          value={value}
          isDisabled={isDisabled}
          onChange={onChangeValue}
          onBlur={() => validate(value, confirmation)}
        />
      </FormGroup>
      <FormGroup
        fieldId="passwordConfirmation"
        label={_("Password confirmation")}
        helperTextInvalid={error}
        validated={error === "" ? "default" : "error"}
      >
        <TextInput
          id="passwordConfirmation"
          name="passwordConfirmation"
          type="password"
          aria-label={_("User password confirmation")}
          value={confirmation}
          isDisabled={isDisabled}
          onChange={onChangeConfirmation}
          onBlur={() => validate(value, confirmation)}
          validated={error === "" ? "default" : "error"}
        />
      </FormGroup>
    </div>
  );
};

export default PasswordAndConfirmationInput;
