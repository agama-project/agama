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

import React, { useEffect } from "react";
import { FormGroup, TextInput } from "@patternfly/react-core";

import { Fieldset } from "~/components/core";
import { Icon } from "~/components/layout";

export default function AuthFields({ data, onChange, onValidate }) {
  const onUsernameChange = v => onChange("username", v);
  const onPasswordChange = v => onChange("password", v);
  const onReverseUsernameChange = v => onChange("reverseUsername", v);
  const onReversePasswordChange = v => onChange("reversePassword", v);

  const isValidText = v => v.length > 0;
  const isValidUsername = () => isValidText(data.username);
  const isValidPassword = () => isValidText(data.password);
  const isValidReverseUsername = () => isValidText(data.reverseUsername);
  const isValidReversePassword = () => isValidText(data.reversePassword);
  const isValidAuth = () => isValidUsername() && isValidPassword();

  const showUsernameError = () => isValidPassword() ? !isValidUsername() : false;
  const showPasswordError = () => isValidUsername() ? !isValidPassword() : false;
  const showReverseUsernameError = () => {
    return (isValidAuth() && isValidReversePassword()) ? !isValidReverseUsername() : false;
  };
  const showReversePasswordError = () => {
    return (isValidAuth() && isValidReverseUsername()) ? !isValidReversePassword() : false;
  };

  useEffect(() => {
    onValidate(
      !showUsernameError() &&
      !showPasswordError() &&
      !showReverseUsernameError() &&
      !showReversePasswordError()
    );
  });

  const ByInitiatorAuthTip = () => {
    if (isValidAuth()) return null;

    return (
      <p>
        <Icon
          name="info"
          size="16"
          style={{ verticalAlign: "text-bottom", marginRight: "0.3em" }}
        />
        Only available if authentication by target is provided
      </p>
    );
  };

  return (
    <>
      <Fieldset legend="Authentication by target">
        <FormGroup
          fieldId="username"
          label="Username"
          helperTextInvalid="Incorrect username"
          validated={showUsernameError() ? "error" : "default"}
        >
          <TextInput
            id="username"
            name="username"
            aria-label="Username"
            value={data.username || ""}
            label="Username"
            onChange={onUsernameChange}
            validated={showUsernameError() ? "error" : "default"}
          />
        </FormGroup>
        <FormGroup
          fieldId="password"
          label="Password"
          helperTextInvalid="Incorrect password"
          validated={showPasswordError() ? "error" : "default"}
        >
          <TextInput
            id="password"
            name="password"
            type="password"
            aria-label="Password"
            value={data.password || ""}
            label="Password"
            onChange={onPasswordChange}
            validated={showPasswordError() ? "error" : "default"}
          />
        </FormGroup>
      </Fieldset>
      <Fieldset legend="Authentication by initiator">
        <ByInitiatorAuthTip />
        <FormGroup
          fieldId="reverseUsername"
          label="Username"
          helperTextInvalid="Incorrect username"
          validated={showReverseUsernameError() ? "error" : "default"}
        >
          <TextInput
            id="reverseUsername"
            name="reverseUsername"
            aria-label="Username"
            value={data.reverseUsername || ""}
            label="Username"
            isDisabled={!isValidAuth()}
            onChange={onReverseUsernameChange}
            validated={showReverseUsernameError() ? "error" : "default"}
          />
        </FormGroup>
        <FormGroup
          fieldId="reversePassword"
          label="Password"
          helperTextInvalid="Incorrect password"
          validated={showReversePasswordError() ? "error" : "default"}
        >
          <TextInput
            id="reversePassword"
            name="reversePassword"
            type="password"
            aria-label="Target Password"
            value={data.reversePassword || ""}
            label="Password"
            isDisabled={!isValidAuth()}
            onChange={onReversePasswordChange}
            validated={showReversePasswordError() ? "error" : "default"}
          />
        </FormGroup>
      </Fieldset>
    </>
  );
}
