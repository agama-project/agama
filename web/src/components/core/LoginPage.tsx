/*
 * Copyright (c) [2024-2026] SUSE LLC
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
  Alert,
  Button,
  Divider,
  Flex,
  Form,
  FormGroup,
  Grid,
  GridItem,
  HelperText,
  HelperTextItem,
  Title,
  Bullseye,
} from "@patternfly/react-core";
import { Page, PasswordInput } from "~/components/core";
import { AuthErrors, useAuth } from "~/context/auth";
import { Icon } from "../layout";
import { sprintf } from "sprintf-js";
import { _ } from "~/i18n";

const getError = (authError) => {
  if (!authError) return;

  if (authError === AuthErrors.AUTH) {
    return {
      title: _("Could not log in"),
      description: _("Make suere that passsword is correct and try again."),
    };
  }

  return { title: _("Could not authenticate against the server.") };
};

/**
 * Renders the UI that lets the user log into the system.
 * @component
 */
export default function LoginPage() {
  const [loading, setLoading] = useState(false);
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState(false);
  const { isLoggedIn, login: loginFn, error: loginError } = useAuth();

  const login = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const result = await loginFn(password);

    setLoading(false);
    setAuthError(result.status !== 200);
  };

  if (isLoggedIn) {
    return <Navigate to="/" />;
  }

  const error = getError(loginError);

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
    <Page emptyHeader>
      <Page.Content>
        <Bullseye>
          <Grid hasGutter>
            <GridItem sm={12} md={6} style={{ alignSelf: "center" }}>
              <Flex
                direction={{ default: "column" }}
                alignItems={{ default: "alignItemsCenter", md: "alignItemsFlexEnd" }}
                alignContent={{ default: "alignContentCenter", md: "alignContentFlexEnd" }}
                alignSelf={{ default: "alignSelfCenter" }}
              >
                <Icon name="lock" width="3rem" height="3rem" />
                <Title headingLevel="h1">{sectionTitle}</Title>
                <HelperText>
                  <HelperTextItem>
                    {rootExplanationStart} <b>{rootUser}</b> {rootExplanationEnd}
                  </HelperTextItem>
                </HelperText>
                <HelperText>
                  <HelperTextItem>
                    {_("Provide its password to log in to the system.")}
                  </HelperTextItem>
                </HelperText>
              </Flex>
            </GridItem>
            <GridItem sm={12} md={6}>
              <Flex
                gap={{ default: "gapMd" }}
                alignItems={{ default: "alignItemsCenter" }}
                style={{ minBlockSize: "30dvh" }}
              >
                <Divider orientation={{ default: "horizontal", md: "vertical" }} />
                <Form id="login" onSubmit={login} aria-label={_("Login form")}>
                  <FormGroup fieldId="password" label={_("Password")}>
                    <PasswordInput
                      id="password"
                      name="password"
                      value={password}
                      aria-label={_("Password input")}
                      onChange={(_, v) => setPassword(v)}
                      reminders={["capslock"]}
                    />
                  </FormGroup>
                  {authError && (
                    <Alert component="div" variant="danger" title={error.title}>
                      {error.description}
                    </Alert>
                  )}
                  <Flex>
                    <Button
                      type="submit"
                      variant={loading ? "secondary" : "primary"}
                      isLoading={loading}
                      isDisabled={loading}
                    >
                      {_("Log in")}
                    </Button>
                  </Flex>
                </Form>
              </Flex>
            </GridItem>
          </Grid>
        </Bullseye>
      </Page.Content>
    </Page>
  );
}
