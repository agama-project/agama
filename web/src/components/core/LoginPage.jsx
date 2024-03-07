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
import {
  ActionGroup,
  Button,
  Form,
  FormGroup,
  TextInput,
} from "@patternfly/react-core";
import { Navigate } from "react-router-dom";
import PasswordInput from "./PasswordInput";
import { _ } from "~/i18n";
import { useAuth } from "~/context/auth";

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

  return (
    <Form id="login" onSubmit={login}>
      <FormGroup fieldId="username">
        <TextInput
          id="username"
          name="username"
          label="Username"
          value="root"
          disabled
        />
      </FormGroup>

      <FormGroup fieldId="password">
        <PasswordInput
          id="password"
          name="password"
          value={password}
          onChange={(_, v) => setPassword(v)}
        />
      </FormGroup>

      <ActionGroup>
        <Button type="submit" variant="primary">{_("Log in")}</Button>
      </ActionGroup>
    </Form>
  );
}
