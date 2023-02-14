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

import React, { useState, useEffect } from "react";
import { useCancellablePromise } from "~/utils";

import { useInstallerClient } from "~/context/installer";
import {
  Alert,
  Button,
  Checkbox,
  Form,
  FormGroup,
  Skeleton,
  Text,
  TextInput
} from "@patternfly/react-core";

import { PasswordAndConfirmationInput, Popup } from '~/components/core';

const initialUser = {
  userName: "",
  fullName: "",
  autologin: false,
  password: ""
};
export default function FirstUser() {
  const client = useInstallerClient();
  const { cancellablePromise } = useCancellablePromise();
  const [user, setUser] = useState(null);
  const [formValues, setFormValues] = useState(initialUser);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [errors, setErrors] = useState([]);
  const [validPassword, setValidPassword] = useState(true);

  useEffect(() => {
    cancellablePromise(client.users.getUser()).then(userValues => {
      setUser(userValues);
      setFormValues({ ...initialUser, ...userValues });
    });
  }, [client.users, cancellablePromise]);

  useEffect(() => {
    return client.users.onUsersChange(changes => {
      if (changes.firstUser !== undefined) {
        setUser(changes.firstUser);
      }
    });
  }, [client.users]);

  if (user === null) return <Skeleton width="50%" fontSize="sm" />;

  const open = () => {
    setFormValues({ ...initialUser, ...user, password: "" });
    setIsFormOpen(true);
  };

  const cancel = () => {
    setErrors([]);
    setIsFormOpen(false);
  };

  const accept = async (e) => {
    e.preventDefault();
    setErrors([]);
    const { result, issues = [] } = await client.users.setUser(formValues);
    setErrors(issues);
    if (result) {
      setUser(formValues);
      setIsFormOpen(false);
    }
  };

  const remove = async () => {
    const result = await client.users.removeUser();

    if (result) {
      setUser(initialUser);
      setFormValues(initialUser);
    }
    setIsFormOpen(false);
  };

  const handleInputChange = (value, { target }) => {
    const { name } = target;
    setFormValues({ ...formValues, [name]: value });
  };

  const userIsDefined = user?.userName !== "";

  const link = content => (
    <Button variant="link" isInline onClick={open}>
      {content}
    </Button>
  );

  const renderLink = () => {
    if (userIsDefined) {
      return <Text>User {link(user.userName)} is defined</Text>;
    } else {
      return <Text>A user {link("is not defined")}</Text>;
    }
  };

  const showErrors = () => ((errors || []).length > 0);
  const buttonDisabled = formValues.userName === "" || formValues.password === "" || !validPassword;
  return (
    <>
      {renderLink()}

      <Popup isOpen={isFormOpen} title="User account">
        <Form id="first-user" onSubmit={accept}>
          { showErrors() &&
            <Alert variant="warning" isInline title="Something went wrong">
              { errors.map((e, i) => <p key={`error_${i}`}>{e}</p>) }
            </Alert> }

          <FormGroup fieldId="userFullName" label="Full name">
            <TextInput
              id="userFullName"
              name="fullName"
              aria-label="User fullname"
              value={formValues.fullName}
              label="User full name"
              onChange={handleInputChange}
            />
          </FormGroup>

          <FormGroup fieldId="userName" label="Username" isRequired>
            <TextInput
              id="userName"
              name="userName"
              aria-label="Username"
              value={formValues.userName}
              label="Username"
              isRequired
              onChange={handleInputChange}
            />
          </FormGroup>

          <PasswordAndConfirmationInput
            value={formValues.password}
            onChange={(value, event) => {
              if (value === "") setValidPassword(true);
              handleInputChange(value, event);
            }}
            onValidation={isValid => setValidPassword(isValid)}
          />

          <Checkbox
            aria-label="user autologin"
            id="autologin"
            name="autologin"
            label="Auto-login"
            isChecked={formValues.autologin}
            onChange={handleInputChange}
          />
        </Form>

        <Popup.Actions>
          <Popup.Confirm form="first-user" type="submit" isDisabled={buttonDisabled} />
          <Popup.Cancel onClick={cancel} />
          <Popup.AncillaryAction onClick={remove} isDisabled={!userIsDefined} key="unset">
            Do not create a user
          </Popup.AncillaryAction>
        </Popup.Actions>
      </Popup>
    </>
  );
}
