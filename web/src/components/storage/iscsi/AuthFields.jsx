/*
 * Copyright (c) [2023-2025] SUSE LLC
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

import React, { useEffect } from "react";
import { Alert, FormGroup, Stack, TextInput } from "@patternfly/react-core";
import { FormValidationError, Page, PasswordInput } from "~/components/core";
import { _ } from "~/i18n";

export default function AuthFields({ data, onChange, onValidate }) {
  const onUsernameChange = (_, v) => onChange("username", v);
  const onPasswordChange = (_, v) => onChange("password", v);
  const onReverseUsernameChange = (_, v) => onChange("reverseUsername", v);
  const onReversePasswordChange = (_, v) => onChange("reversePassword", v);

  const isValidText = (v) => v.length > 0;
  const isValidUsername = () => isValidText(data.username);
  const isValidPassword = () => isValidText(data.password);
  const isValidReverseUsername = () => isValidText(data.reverseUsername);
  const isValidReversePassword = () => isValidText(data.reversePassword);
  const isValidAuth = () => isValidUsername() && isValidPassword();

  const showUsernameError = () => (isValidPassword() ? !isValidUsername() : false);
  const showPasswordError = () => (isValidUsername() ? !isValidPassword() : false);
  const showReverseUsernameError = () => {
    return isValidAuth() && isValidReversePassword() ? !isValidReverseUsername() : false;
  };
  const showReversePasswordError = () => {
    return isValidAuth() && isValidReverseUsername() ? !isValidReversePassword() : false;
  };

  useEffect(() => {
    onValidate(
      !showUsernameError() &&
        !showPasswordError() &&
        !showReverseUsernameError() &&
        !showReversePasswordError(),
    );
  });

  const ByInitiatorAuthTip = () => {
    if (isValidAuth()) return null;

    return (
      <Alert
        isPlain
        component="small"
        title={_("Only available if authentication by target is provided")}
      />
    );
  };

  return (
    <>
      <Page.Section title={_("Authentication by target")} hasHeaderDivider>
        <Stack hasGutter>
          <FormGroup fieldId="username" label={_("User name")}>
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
          <FormGroup fieldId="password" label={_("Password")}>
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
        </Stack>
      </Page.Section>
      <Page.Section
        pfCardProps={{ variant: isValidAuth() ? "default" : "secondary" }}
        title={_("Authentication by initiator")}
        hasHeaderDivider
      >
        <Stack hasGutter>
          <ByInitiatorAuthTip />
          <FormGroup fieldId="reverseUsername" label={_("User name")}>
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
            <FormValidationError
              message={showReverseUsernameError() ? _("Incorrect user name") : ""}
            />
          </FormGroup>
          <FormGroup fieldId="reversePassword" label="Password">
            <PasswordInput
              id="reversePassword"
              name="reversePassword"
              aria-label={_("Target Password")}
              value={data.reversePassword || ""}
              isDisabled={!isValidAuth()}
              onChange={onReversePasswordChange}
              validated={showReversePasswordError() ? "error" : "default"}
            />
            <FormValidationError
              message={showReverseUsernameError() ? _("Incorrect password") : ""}
            />
          </FormGroup>
        </Stack>
      </Page.Section>
    </>
  );
}
