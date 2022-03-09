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

import React, { useState, useRef } from "react";
import { useAuthContext } from "./context/auth";
import {
  Alert,
  Bullseye,
  Button,
  Flex,
  FlexItem,
  Form,
  FormAlert,
  FormGroup,
  TextInput
} from "@patternfly/react-core";

import Layout from "./Layout";

const formError = error => (
  <FormAlert>
    <Alert variant="danger" title={error} aria-live="polite" isInline />
  </FormAlert>
);

function LoginForm() {
  const [error, setError] = useState();
  const { login } = useAuthContext();
  const usernameRef = useRef();
  const passwordRef = useRef();

  const submitLogin = e => {
    e.preventDefault();

    setError(undefined);
    login(usernameRef.current.value, passwordRef.current.value)
      .then(() => window.location.reload())
      .catch(() => {
        setError("Authentication failed.");
      });
  };

  const SubmitButton = () => {
    return (
      <Flex justifyContent={{ default: "justifyContentFlexEnd" }}>
        <FlexItem>
          <Button
            isLarge
            variant="primary"
            type="submit"
            form="d-installer-login"
            onClick={submitLogin}
          >
            Login
          </Button>
        </FlexItem>
      </Flex>
    );
  };

  return (
    <Layout sectionTitle="Welcome to D-Installer" FooterActions={SubmitButton}>
      <Bullseye className="layout__content-child--filling-block-size">
        <Form id="d-installer-login">
          {error && formError(error)}
          <FormGroup label="Username" fieldId="username">
            <TextInput isRequired type="text" id="username" ref={usernameRef} />
          </FormGroup>
          <FormGroup label="Password" fieldId="password">
            <TextInput isRequired type="password" id="password" ref={passwordRef} />
          </FormGroup>
        </Form>
      </Bullseye>
    </Layout>
  );
}

export default LoginForm;
