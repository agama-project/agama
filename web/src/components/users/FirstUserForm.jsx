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

import React, { useState, useEffect, useRef } from "react";
import {
  Alert,
  Checkbox,
  Form,
  FormGroup,
  TextInput,
  Menu,
  MenuContent,
  MenuList,
  MenuItem,
  Grid,
  GridItem,
  Stack,
  Switch,
} from "@patternfly/react-core";
import { useNavigate } from "react-router-dom";
import { Loading } from "~/components/layout";
import { PasswordAndConfirmationInput, Page } from "~/components/core";
import { _ } from "~/i18n";
import { useCancellablePromise } from "~/utils";
import { useInstallerClient } from "~/context/installer";
import { suggestUsernames } from "~/components/users/utils";

const UsernameSuggestions = ({
  isOpen = false,
  entries,
  onSelect,
  setInsideDropDown,
  focusedIndex = -1,
}) => {
  if (!isOpen) return;

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
              {/* TRANSLATORS: dropdown username suggestions */}
              {_("Use suggested username")} <b>{suggestion}</b>
            </MenuItem>
          ))}
        </MenuList>
      </MenuContent>
    </Menu>
  );
};

// TODO: create an object for errors using the input name as key and show them
// close to the related input.
// TODO: extract the suggestions logic.
export default function FirstUserForm() {
  const client = useInstallerClient();
  const { cancellablePromise } = useCancellablePromise();
  const [state, setState] = useState({});
  const [errors, setErrors] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [insideDropDown, setInsideDropDown] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const [suggestions, setSuggestions] = useState([]);
  const [changePassword, setChangePassword] = useState(true);
  const usernameInputRef = useRef();
  const navigate = useNavigate();
  const passwordRef = useRef();

  useEffect(() => {
    cancellablePromise(client.users.getUser()).then((userValues) => {
      const editing = userValues.userName !== "";
      setState({
        load: true,
        user: userValues,
        isEditing: editing,
      });
      setChangePassword(!editing);
    });
  }, [client.users, cancellablePromise]);

  useEffect(() => {
    return client.users.onUsersChange(({ firstUser }) => {
      if (firstUser !== undefined) {
        setState({ ...state, user: firstUser });
      }
    });
  }, [client.users, state]);

  useEffect(() => {
    if (showSuggestions) {
      setFocusedIndex(-1);
    }
  }, [showSuggestions]);

  if (!state.load) return <Loading />;

  const onSubmit = async (e) => {
    e.preventDefault();
    setErrors([]);

    const passwordInput = passwordRef.current;
    const formData = new FormData(e.target);
    const user = {};
    // FIXME: have a look to https://www.patternfly.org/components/forms/form#form-state
    formData.forEach((value, key) => {
      user[key] = value;
    });

    if (!changePassword) {
      delete user.password;
    }
    delete user.passwordConfirmation;
    user.autologin = !!user.autologin;

    if (!passwordInput?.validity.valid) {
      setErrors([passwordInput?.validationMessage]);
      return;
    }

    // FIXME: improve validations
    if (Object.values(user).some((v) => v === "")) {
      setErrors([_("All fields are required")]);
      return;
    }

    const { result, issues = [] } = await client.users.setUser({ ...state.user, ...user });
    if (!result || issues.length) {
      // FIXME: improve error handling. See client.
      setErrors(issues.length ? issues : [_("Please, try again.")]);
    } else {
      navigate("..");
    }
  };

  const onSuggestionSelected = (suggestion) => {
    if (!usernameInputRef.current) return;
    usernameInputRef.current.value = suggestion;
    usernameInputRef.current.focus();
    setInsideDropDown(false);
    setShowSuggestions(false);
  };

  const renderSuggestions = (e) => {
    if (suggestions.length === 0) return;
    setShowSuggestions(e.target.value === "");
  };

  const handleKeyDown = (e) => {
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault(); // Prevent page scrolling
        renderSuggestions(e);
        setFocusedIndex((prevIndex) => (prevIndex + 1) % suggestions.length);
        break;
      case "ArrowUp":
        e.preventDefault(); // Prevent page scrolling
        renderSuggestions(e);
        setFocusedIndex(
          (prevIndex) =>
            (prevIndex - (prevIndex === -1 ? 0 : 1) + suggestions.length) % suggestions.length,
        );
        break;
      case "Enter":
        if (focusedIndex >= 0) {
          e.preventDefault();
          onSuggestionSelected(suggestions[focusedIndex]);
        }
        break;
      case "Escape":
      case "Tab":
        setShowSuggestions(false);
        break;
      default:
        renderSuggestions(e);
        break;
    }
  };

  return (
    <>
      <Page.Header>
        <h2>{state.isEditing ? _("Edit user") : _("Create user")}</h2>
      </Page.Header>

      <Page.MainContent>
        <Form id="firstUserForm" onSubmit={onSubmit}>
          {errors.length > 0 && (
            <Alert variant="warning" isInline title={_("Something went wrong")}>
              {errors.map((e, i) => (
                <p key={`error_${i}`}>{e}</p>
              ))}
            </Alert>
          )}
          <Grid hasGutter>
            <GridItem sm={12} xl={6} rowSpan={2}>
              <Page.CardSection isFullHeight>
                <Stack hasGutter>
                  <FormGroup fieldId="userFullName" label={_("Full name")}>
                    <TextInput
                      id="userFullName"
                      name="fullName"
                      aria-label={_("User full name")}
                      defaultValue={state.user.fullName}
                      label={_("User full name")}
                      onBlur={(e) => setSuggestions(suggestUsernames(e.target.value))}
                    />
                  </FormGroup>

                  <FormGroup
                    className="first-username-wrapper"
                    fieldId="userName"
                    label={_("Username")}
                  >
                    <TextInput
                      id="userName"
                      name="userName"
                      aria-label={_("Username")}
                      ref={usernameInputRef}
                      defaultValue={state.user.userName}
                      label={_("Username")}
                      isRequired
                      onFocus={renderSuggestions}
                      onKeyDown={handleKeyDown}
                      onBlur={() => !insideDropDown && setShowSuggestions(false)}
                    />
                    <UsernameSuggestions
                      isOpen={showSuggestions}
                      entries={suggestions}
                      onSelect={onSuggestionSelected}
                      setInsideDropDown={setInsideDropDown}
                      focusedIndex={focusedIndex}
                    />
                  </FormGroup>
                </Stack>
              </Page.CardSection>
            </GridItem>
            <GridItem sm={12} xl={6}>
              <Page.CardSection>
                <Stack hasGutter>
                  {state.isEditing && (
                    <Switch
                      label={_("Edit password too")}
                      isChecked={changePassword}
                      onChange={() => setChangePassword(!changePassword)}
                    />
                  )}
                  <PasswordAndConfirmationInput
                    inputRef={passwordRef}
                    isDisabled={!changePassword}
                    showErrors={false}
                  />
                </Stack>
              </Page.CardSection>
            </GridItem>
            <GridItem sm={12} xl={6}>
              <Page.CardSection>
                <Checkbox
                  aria-label={_("user autologin")}
                  id="autologin"
                  name="autologin"
                  // TRANSLATORS: check box label
                  label={_("Auto-login")}
                  defaultChecked={state.user.autologin}
                />
              </Page.CardSection>
            </GridItem>
          </Grid>
        </Form>
      </Page.MainContent>

      <Page.NextActions>
        <Page.CancelAction />
        <Page.Action type="submit" form="firstUserForm">
          {_("Accept")}
        </Page.Action>
      </Page.NextActions>
    </>
  );
}
