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
import { useCancellablePromise } from "@/utils";

import { useInstallerClient } from "@context/installer";
import {
  Button,
  Checkbox,
  Form,
  FormGroup,
  Skeleton,
  Text,
  TextInput
} from "@patternfly/react-core";

import { Popup } from '@components/core';

const initialUser = {
  userName: "",
  fullName: "",
  autologin: false,
  password: ""
};
export default function Users() {
  const client = useInstallerClient();
  const { cancellablePromise } = useCancellablePromise();
  const [user, setUser] = useState(null);
  const [formValues, setFormValues] = useState(initialUser);
  const [isFormOpen, setIsFormOpen] = useState(false);

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
    setIsFormOpen(false);
  };

  const accept = async (e) => {
    e.preventDefault();
    const result = await client.users.setUser(formValues);

    if (result) {
      setUser(formValues);
    }
    setIsFormOpen(false);
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

  return (
    <>
      {renderLink()}

      <Popup isOpen={isFormOpen} title="User account">
        <Form id="first-user" onSubmit={accept}>
          <FormGroup fieldId="userFullName" label="Full name">
            <TextInput
              id="userFullName"
              name="fullName"
              aria-label="User fullname"
              value={formValues.fullName}
              label="User full Name"
              onChange={handleInputChange}
            />
          </FormGroup>

          <FormGroup fieldId="userName" label="Username">
            <TextInput
              id="userName"
              name="userName"
              aria-label="Username"
              value={formValues.userName}
              label="Username"
              required
              onChange={handleInputChange}
            />
          </FormGroup>

          <FormGroup fieldId="userPassword" label="Password">
            <TextInput
              id="userPassword"
              name="password"
              type="password"
              aria-label="User password"
              value={formValues.password}
              onChange={handleInputChange}
            />
          </FormGroup>

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
          <Popup.Confirm form="first-user" type="submit" isDisabled={formValues.userName === ""} />
          <Popup.Cancel onClick={cancel} />
          <Popup.AncillaryAction onClick={remove} isDisabled={!userIsDefined} key="unset">
            Do not create a user
          </Popup.AncillaryAction>
        </Popup.Actions>
      </Popup>
    </>
  );
}
