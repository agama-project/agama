/*
 * Copyright (c) [2024] SUSE LLC
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
import { Navigate } from "react-router-dom";
import {
  ActionGroup,
  Button,
  Form,
  FormGroup,
} from "@patternfly/react-core";
import { sprintf } from "sprintf-js";
import { _ } from "~/i18n";
import { useAuth } from "~/context/auth";
import { About, Page, PasswordInput, Section } from "~/components/core";
import { Center } from "~/components/layout";

// @ts-check

/**
 * Renders the UI that lets the user log into the system.
 * @component
 *
 */
export default function LoginPage() {
  const [password, setPassword] = useState("");
  const { isAuthenticated, login: loginFn } = useAuth();

  const login = async (e) => {
    e.preventDefault();
    await loginFn(password);
  };

  if (isAuthenticated) {
    return <Navigate to="/" />;
  }

  // TRANSLATORS: Title for a form to provide the password for the root user. %s
  // will be replaced by "root"
  const sectionTitle = sprintf(_("Login as %s"), "root");
  return (
    <Page mountSidebar={false} title="Agama">
      <Center>
        <Section title={sectionTitle}>
          <p
            dangerouslySetInnerHTML={{
              __html: sprintf(
                _("The installer requires %s user privileges. Please, provide its password to log into the system."),
                "<b>root</b>"
              )
            }}
          />

          <Form id="login" onSubmit={login} aria-label={_("Login form")}>
            <FormGroup fieldId="password">
              <PasswordInput
                id="password"
                name="password"
                value={password}
                aria-label={_("Password input")}
                onChange={(_, v) => setPassword(v)}
              />
            </FormGroup>

            <ActionGroup>
              <Button type="submit" variant="primary">
                {_("Log in")}
              </Button>
            </ActionGroup>
          </Form>
        </Section>
      </Center>

      <Page.Actions>
        <About showIcon={false} iconSize="xs" buttonText={_("What is this?")} buttonVariant="link" />
      </Page.Actions>
    </Page>
  );
}
