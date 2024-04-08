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

import { _ } from "~/i18n";
import { useCancellablePromise } from "~/utils";
import { useInstallerClient } from "~/context/installer";
import {
  Alert,
  Button,
  Checkbox,
  Form,
  FormGroup,
  TextInput,
  Skeleton,
  Menu,
  MenuContent,
  MenuList,
  MenuItem
} from "@patternfly/react-core";

import { Table, Thead, Tr, Th, Tbody, Td } from '@patternfly/react-table';

import { RowActions, PasswordAndConfirmationInput, Popup, If } from '~/components/core';

import { suggestUsernames } from '~/components/users/utils';

const UserNotDefined = ({ actionCb }) => {
  return (
    <div className="stack">
      <div>{_("No user defined yet.")}</div>
      <div>
        <strong>
          {_("Please, be aware that a user must be defined before installing the system to be able to log into it.")}
        </strong>
      </div>
      {/* TRANSLATORS: push button label */}
      <Button variant="primary" onClick={actionCb}>{_("Define a user now")}</Button>
    </div>
  );
};

const UserData = ({ user, actions }) => {
  return (
    <Table variant="compact">
      <Thead>
        <Tr>
          <Th width={25}>{_("Full name")}</Th>
          <Th>{_("Username")}</Th>
          <Th />
        </Tr>
      </Thead>
      <Tbody>
        <Tr>
          <Td dataLabel="Fullname">{user.fullName}</Td>
          <Td dataLabel="Username">{user.userName}</Td>
          <Td isActionCell>
            <RowActions actions={actions} id={`actions-for-${user.userName}`} />
          </Td>
        </Tr>
      </Tbody>
    </Table>
  );
};

const UsernameSuggestions = ({ entries, onSelect, setInsideDropDown, focusedIndex = -1 }) => {
  return (
    <Menu
      aria-label={_("Username suggestion dropdown")}
      className="first-username-dropdown"
      onMouseEnter={() => setInsideDropDown(true)}
      onMouseLeave={() => setInsideDropDown(false)}
    >
      <MenuContent>
        <MenuList>
          {entries.map((suggestion, index) => (
            <MenuItem
              key={index}
              itemId={index}
              isFocused={focusedIndex === index}
              onClick={() => onSelect(suggestion)}
            >
              { /* TRANSLATORS: dropdown username suggestions */}
              {_("Use suggested username")} <b>{suggestion}</b>
            </MenuItem>
          ))}
        </MenuList>
      </MenuContent>
    </Menu>
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
  const [isSettingPassword, setIsSettingPassword] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [insideDropDown, setInsideDropDown] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const [suggestions, setSuggestions] = useState([]);

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
    // Password will be always set when creating the user. In the edit mode it
    // depends on the user choice
    setIsSettingPassword(mode === CREATE_MODE);
    // To avoid confusion, do not expose the current password
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

    // Preserve current password value if the user was not editing it.
    const newUser = { ...formValues };
    if (!isSettingPassword) newUser.password = user.password;

    const { result, issues = [] } = await client.users.setUser(newUser);
    setErrors(issues);
    setIsLoading(false);
    if (result) {
      setUser(newUser);

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

  const handleInputChange = ({ target }, value) => {
    const { name } = target;
    setFormValues({ ...formValues, [name]: value });
  };

  const isUserDefined = user?.userName && user?.userName !== "";
  const showErrors = () => ((errors || []).length > 0);

  const actions = [
    {
      title: _("Edit"),
      onClick: (e) => openForm(e, EDIT_MODE)
    },
    {
      title: _("Discard"),
      onClick: remove,
      isDanger: true
    }
  ];

  const toggleShowPasswordField = () => setIsSettingPassword(!isSettingPassword);
  const usingValidPassword = formValues.password && formValues.password !== "" && isValidPassword;
  const submitDisable = formValues.userName === "" || (isSettingPassword && !usingValidPassword);

  const displaySuggestions = !formValues.userName && formValues.fullName && showSuggestions;
  useEffect(() => {
    if (displaySuggestions) {
      setFocusedIndex(-1);
      setSuggestions(suggestUsernames(formValues.fullName));
    }
  }, [displaySuggestions, formValues.fullName]);

  const onSuggestionSelected = (suggestion) => {
    setInsideDropDown(false);
    setFormValues({ ...formValues, userName: suggestion });
  };

  const handleKeyDown = (event) => {
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault(); // Prevent page scrolling
        setFocusedIndex((prevIndex) => (prevIndex + 1) % suggestions.length);
        break;
      case 'ArrowUp':
        event.preventDefault(); // Prevent page scrolling
        setFocusedIndex((prevIndex) => (prevIndex - (prevIndex === -1 ? 0 : 1) + suggestions.length) % suggestions.length);
        break;
      case 'Enter':
        if (focusedIndex >= 0) {
          onSuggestionSelected(suggestions[focusedIndex]);
        }
        break;
      default:
        break;
    }
  };

  if (isLoading) return <Skeleton />;

  return (
    <>
      { isUserDefined ? <UserData user={user} actions={actions} /> : <UserNotDefined actionCb={openForm} /> }
      { /* TODO: Extract this form to a component, if possible */ }
      { isFormOpen &&
        <Popup isOpen title={isEditing ? _("Edit user account") : _("Create user account")}>
          <Form id="createUser" onSubmit={(e) => accept("createUser", e)}>
            { showErrors() &&
              <Alert variant="warning" isInline title={_("Something went wrong")}>
                { errors.map((e, i) => <p key={`error_${i}`}>{e}</p>) }
              </Alert> }

            <FormGroup fieldId="userFullName" label={_("Full name")}>
              <TextInput
                id="userFullName"
                name="fullName"
                aria-label={_("User full name")}
                value={formValues.fullName}
                label={_("User full name")}
                onChange={handleInputChange}
              />
            </FormGroup>

            <FormGroup
              className="first-username-wrapper"
              fieldId="userName"
              label={_("Username")}
              isRequired
              onFocus={() => setShowSuggestions(true)}
              onBlur={() => !insideDropDown && setShowSuggestions(false)}
            >
              <TextInput
                id="userName"
                name="userName"
                aria-label={_("Username")}
                value={formValues.userName}
                label={_("Username")}
                isRequired
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
              />
              <If
                condition={displaySuggestions}
                then={
                  <UsernameSuggestions
                    entries={suggestions}
                    onSelect={onSuggestionSelected}
                    setInsideDropDown={setInsideDropDown}
                    focusedIndex={focusedIndex}
                  />
                }
              />
            </FormGroup>

            { isEditing &&
              <Checkbox
                aria-label={_("Edit password too")}
                id="edit-password"
                name="edit-password"
                // TRANSLATORS: check box label
                label={_("Edit password too")}
                isChecked={isSettingPassword}
                onChange={toggleShowPasswordField}
              /> }

            { isSettingPassword &&
              <PasswordAndConfirmationInput
                value={formValues.password}
                onChange={handleInputChange}
                onValidation={isValid => setIsValidPassword(isValid)}
              /> }

            <Checkbox
              aria-label={_("user autologin")}
              id="autologin"
              name="autologin"
              // TRANSLATORS: check box label
              label={_("Auto-login")}
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
