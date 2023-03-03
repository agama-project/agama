/*
 * Copyright (c) [2022-2023] SUSE LLC
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
  DropdownToggle,
  Form,
  FormGroup,
  TextInput,
  Skeleton,
} from "@patternfly/react-core";

import { TableComposable, Thead, Tr, Th, Tbody, Td, ActionsColumn } from '@patternfly/react-table';

import { Icon } from '~/components/layout';
import { PasswordAndConfirmationInput, Popup } from '~/components/core';

const RowActions = ({ actions, id, ...props }) => {
  const actionsToggle = (props) => (
    <DropdownToggle
      id={id}
      aria-label="Actions"
      toggleIndicator={null}
      isDisabled={props.isDisabled}
      onToggle={props.onToggle}
    >
      <Icon name="more_vert" size="24" />
    </DropdownToggle>
  );

  return (
    <ActionsColumn
      items={actions}
      actionsToggle={actionsToggle}
      {...props}
    />
  );
};

const UserNotDefined = ({ actionCb }) => {
  return (
    <div className="stack">
      <div className="bold">No user defined yet</div>
      <div>Please, be aware that a user must be defined before installing the system to be able to log into it.</div>
      <Button variant="primary" onClick={actionCb}>Define a user now</Button>
    </div>
  );
};

const UserData = ({ user, actions }) => {
  return (
    <TableComposable gridBreakPoint="grid-sm" variant="compact" className="users">
      <Thead>
        <Tr>
          <Th width={25}>Fullname</Th>
          <Th>Username</Th>
          <Th />
        </Tr>
      </Thead>
      <Tbody>
        <Tr>
          <Td>{user.fullName}</Td>
          <Td>{user.userName}</Td>
          <Td isActionCell>
            <RowActions actions={actions} id={`actions-for-${user.userName}`} />
          </Td>
        </Tr>
      </Tbody>
    </TableComposable>
  );
};

const CREATE_MODE = 'create';
const EDIT_MODE = 'edit';

const initialUser = {
  userName: "",
  fullName: "",
  autologin: false,
  password: "",
};

export default function FirstUser() {
  const client = useInstallerClient();
  const { cancellablePromise } = useCancellablePromise();
  const [user, setUser] = useState({});
  const [errors, setErrors] = useState([]);
  const [formValues, setFormValues] = useState(initialUser);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isValidPassword, setIsValidPassword] = useState(true);
  const [showPasswordField, setShowPasswordField] = useState(false);

  useEffect(() => {
    cancellablePromise(client.users.getUser()).then(userValues => {
      setUser(userValues);
      setFormValues({ ...initialUser, ...userValues });
      setIsLoading(false);
    });
  }, [client.users, cancellablePromise]);

  useEffect(() => {
    return client.users.onUsersChange(changes => {
      if (changes.firstUser !== undefined) {
        setUser(changes.firstUser);
      }
    });
  }, [client.users]);

  const openForm = (e, mode = CREATE_MODE) => {
    setIsEditing(mode === EDIT_MODE);
    setShowPasswordField(mode === CREATE_MODE);
    setFormValues({ ...initialUser, ...user, password: "" });
    setIsFormOpen(true);
  };

  const closeForm = () => {
    setErrors([]);
    setIsEditing(false);
    setIsFormOpen(false);
  };

  const accept = async (formName, e) => {
    e.preventDefault();
    setErrors([]);
    setIsLoading(true);
    const { result, issues = [] } = await client.users.setUser(formValues);
    setErrors(issues);
    setIsLoading(false);
    if (result) {
      setUser(formValues);
      closeForm();
    }
  };

  const remove = async () => {
    setIsLoading(true);

    const result = await client.users.removeUser();

    if (result) {
      setUser(initialUser);
      setFormValues(initialUser);
      setIsLoading(false);
    }
  };

  const handleInputChange = (value, { target }) => {
    const { name } = target;
    setFormValues({ ...formValues, [name]: value });
  };

  const isUserDefined = user?.userName && user?.userName !== "";
  const showErrors = () => ((errors || []).length > 0);

  const actions = [
    {
      title: "Edit",
      onClick: (e) => openForm(e, EDIT_MODE)
    },
    {
      title: "Discard",
      onClick: remove,
      className: "danger-action"
    }
  ];

  const toggleShowPasswordField = () => setShowPasswordField(!showPasswordField);
  const usingValidPassword = formValues.password && formValues.password !== "" && isValidPassword;
  const submitDisable = formValues.userName === "" || (showPasswordField && !usingValidPassword);

  if (isLoading) return <Skeleton />;

  return (
    <>
      { isUserDefined ? <UserData user={user} actions={actions} /> : <UserNotDefined actionCb={openForm} /> }
      { /* TODO: Extract this form to a component, if possible */ }
      { isFormOpen &&
        <Popup isOpen height="medium" title={isEditing ? "Edit user account" : "Create user account"}>
          <Form id="createUser" onSubmit={(e) => accept("createUser", e)}>
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

            { isEditing &&
              <Checkbox
                aria-label="Edit password too"
                id="edit-password"
                name="edit-password"
                label="Edit password too"
                isChecked={showPasswordField}
                onChange={toggleShowPasswordField}
              /> }

            { showPasswordField &&
              <PasswordAndConfirmationInput
                value={formValues.password}
                onChange={(value, event) => {
                  handleInputChange(value, event);
                }}
                onValidation={isValid => setIsValidPassword(isValid)}
              /> }

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
            <Popup.Confirm
              form="createUser"
              type="submit"
              isDisabled={submitDisable}
            />
            <Popup.Cancel onClick={closeForm} />
          </Popup.Actions>
        </Popup> }
    </>
  );
}
