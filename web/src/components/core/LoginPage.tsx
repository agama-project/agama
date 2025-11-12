/*
 * Copyright (c) [2024-2025] SUSE LLC
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
import { Navigate } from "react-router";
import {
  ActionGroup,
  Alert,
  Bullseye,
  Button,
  Flex,
  Form,
  FormGroup,
  FormHelperText,
  HelperText,
  HelperTextItem,
} from "@patternfly/react-core";
import { Page, PasswordInput } from "~/components/core";
import { AuthErrors, useAuth } from "~/context/auth";
import { Icon } from "../layout";
import shadowUtils from "@patternfly/react-styles/css/utilities/BoxShadow/box-shadow";
import { sprintf } from "sprintf-js";
import { _ } from "~/i18n";

/**
 * Renders the UI that lets the user log into the system.
 * @component
 */
export default function LoginPage() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState(false);
  const { isLoggedIn, login: loginFn, error: loginError } = useAuth();

  const login = async (e: React.FormEvent) => {
    e.preventDefault();
    const result = await loginFn(password);

    setError(result.status !== 200);
  };

  const errorMessage = (authError) => {
    if (authError === AuthErrors.AUTH)
      return _("Could not log in. Please, make sure that the password is correct.");

    return _("Could not authenticate against the server, please check it.");
  };
  if (isLoggedIn) {
    return <Navigate to="/" />;
  }

  // TRANSLATORS: Title for a form to provide the password for the root user. %s
  // will be replaced by "root"
  const sectionTitle = sprintf(_("Log in as %s"), "root");

  // TRANSLATORS: description why root password is needed. The text in the
  // square brackets [] is displayed in bold, use only please, do not translate
  // it and keep the brackets.
  const [rootExplanationStart, rootUser, rootExplanationEnd] = _(
    "The installer requires [root] \
user privileges.",
  ).split(/[[\]]/);

  return (
    <Page.Content>
      <Bullseye>
        <Page.Section
          hasHeaderDivider
          headingLevel="h1"
          title={
            <Flex
              alignItems={{ default: "alignItemsCenter" }}
              direction={{ default: "column" }}
              gap={{ default: "gapSm" }}
            >
              <Icon name="lock" width="3rem" height="3rem" />
              {sectionTitle}
            </Flex>
          }
          pfCardProps={{
            isCompact: false,
            isFullHeight: false,
            className: shadowUtils.boxShadowMd,
          }}
        >
          <Form id="login" onSubmit={login} aria-label={_("Login form")}>
            {error && <Alert variant="danger" title={errorMessage(loginError)} />}

            <FormGroup fieldId="password" label={_("Password")}>
              <PasswordInput
                id="password"
                name="password"
                value={password}
                aria-label={_("Password input")}
                onChange={(_, v) => setPassword(v)}
                reminders={["capslock"]}
              />
              <FormHelperText>
                <HelperText>
                  <HelperTextItem>
                    {rootExplanationStart} <b>{rootUser}</b> {rootExplanationEnd}
                  </HelperTextItem>
                  <HelperTextItem>
                    {_("Please, provide its password to log in to the system.")}
                  </HelperTextItem>
                </HelperText>
              </FormHelperText>
            </FormGroup>

            <ActionGroup>
              <Button type="submit" variant="primary">
                {_("Log in")}
              </Button>
            </ActionGroup>
          </Form>
        </Page.Section>
      </Bullseye>
    </Page.Content>
  );
}
