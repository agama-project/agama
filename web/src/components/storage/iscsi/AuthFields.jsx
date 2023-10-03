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

import { Fieldset, FormValidationError, PasswordInput } from "~/components/core";
import { Icon } from "~/components/layout";
import { _ } from "~/i18n";

export default function AuthFields({ data, onChange, onValidate }) {
  const onUsernameChange = (_, v) => onChange("username", v);
  const onPasswordChange = (_, v) => onChange("password", v);
  const onReverseUsernameChange = (_, v) => onChange("reverseUsername", v);
  const onReversePasswordChange = (_, v) => onChange("reversePassword", v);

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
        {_("Only available if authentication by target is provided")}
      </p>
    );
  };

  return (
    <>
      <Fieldset legend={_("Authentication by target")}>
        <FormGroup
          fieldId="username"
          label={_("User name")}
        >
          <TextInput
            id="username"
            name="username"
            aria-label={_("User name")}
            value={data.username || ""}
            label={_("User name")}
            onChange={onUsernameChange}
            validated={showUsernameError() ? "error" : "default"}
          />
          <FormValidationError message={showUsernameError() ? _("Incorrect user name") : ""} />
        </FormGroup>
        <FormGroup
          fieldId="password"
          label={_("Password")}
        >
          <PasswordInput
            id="password"
            name="password"
            aria-label={_("Password")}
            value={data.password || ""}
            onChange={onPasswordChange}
            validated={showPasswordError() ? "error" : "default"}
          />
          <FormValidationError message={showPasswordError() ? _("Incorrect password") : ""} />
        </FormGroup>
      </Fieldset>
      <Fieldset legend={_("Authentication by initiator")}>
        <ByInitiatorAuthTip />
        <FormGroup
          fieldId="reverseUsername"
          label={_("User name")}
        >
          <TextInput
            id="reverseUsername"
            name="reverseUsername"
            aria-label={_("User name")}
            value={data.reverseUsername || ""}
            label={_("User name")}
            isDisabled={!isValidAuth()}
            onChange={onReverseUsernameChange}
            validated={showReverseUsernameError() ? "error" : "default"}
          />
          <FormValidationError message={showReverseUsernameError() ? _("Incorrect user name") : ""} />
        </FormGroup>
        <FormGroup
          fieldId="reversePassword"
          label="Password"
        >
          <PasswordInput
            id="reversePassword"
            name="reversePassword"
            aria-label={_("Target Password")}
            value={data.reversePassword || ""}
            isDisabled={!isValidAuth()}
            onChange={onReversePasswordChange}
            validated={showReversePasswordError() ? "error" : "default"}
          />
          <FormValidationError message={showReverseUsernameError() ? _("Incorrect password") : ""} />
        </FormGroup>
      </Fieldset>
    </>
  );
}
