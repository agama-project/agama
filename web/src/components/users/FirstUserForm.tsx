/*
 * Copyright (c) [2022-2025] SUSE LLC
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

import React, { useState, useEffect, useRef } from "react";
import {
  Alert,
  Form,
  FormGroup,
  TextInput,
  Menu,
  MenuContent,
  MenuList,
  MenuItem,
  Switch,
  Content,
  ActionGroup,
} from "@patternfly/react-core";
import { useNavigate } from "react-router-dom";
import { Loading } from "~/components/layout";
import { PasswordAndConfirmationInput, Page } from "~/components/core";
import { _ } from "~/i18n";
import { suggestUsernames } from "~/components/users/utils";
import { useFirstUser, useFirstUserMutation } from "~/queries/users";
import { FirstUser } from "~/types/users";

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
          {entries.map((suggestion: string, index: number) => (
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
  const firstUser = useFirstUser();
  const setFirstUser = useFirstUserMutation();
  const [errors, setErrors] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [insideDropDown, setInsideDropDown] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const [suggestions, setSuggestions] = useState([]);
  const [changePassword, setChangePassword] = useState(firstUser?.userName === "");
  const usernameInputRef = useRef<HTMLInputElement>();
  const navigate = useNavigate();
  const passwordRef = useRef<HTMLInputElement>();

  useEffect(() => {
    if (showSuggestions) {
      setFocusedIndex(-1);
    }
  }, [showSuggestions]);

  if (!firstUser) return <Loading />;

  const isEditing = firstUser.userName !== "";

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErrors([]);

    const passwordInput = passwordRef.current;
    const formData = new FormData(e.currentTarget);
    const user: Partial<FirstUser> & { passwordConfirmation?: string } = {};
    // FIXME: have a look to https://www.patternfly.org/components/forms/form#form-state
    formData.forEach((value, key) => {
      user[key] = value;
    });

    if (!changePassword) {
      delete user.password;
    } else {
      // the web UI only supports plain text passwords, this resets the flag if a hashed
      // password was previously set from CLI
      user.hashedPassword = false;
    }
    delete user.passwordConfirmation;

    if (changePassword && !passwordInput?.validity.valid) {
      setErrors([passwordInput?.validationMessage]);
      return;
    }

    // FIXME: improve validations
    if (Object.values(user).some((v) => v === "")) {
      setErrors([_("All fields are required")]);
      return;
    }

    setFirstUser
      .mutateAsync({ ...firstUser, ...user })
      .catch((e) => setErrors(e))
      .then(() => navigate(".."));
  };

  const onSuggestionSelected = (suggestion: string) => {
    if (!usernameInputRef.current) return;
    usernameInputRef.current.value = suggestion;
    usernameInputRef.current.focus();
    setInsideDropDown(false);
    setShowSuggestions(false);
  };

  const renderSuggestions = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (suggestions.length === 0) return;
    setShowSuggestions(e.currentTarget.value === "");
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
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
    <Page>
      <Page.Header>
        <Content component="h2">{isEditing ? _("Edit user") : _("Create user")}</Content>
      </Page.Header>

      <Page.Content>
        <Form id="firstUserForm" onSubmit={onSubmit} isWidthLimited maxWidth="fit-content">
          {errors.length > 0 && (
            <Alert variant="warning" isInline title={_("Something went wrong")}>
              {errors.map((e, i) => (
                <p key={`error_${i}`}>{e}</p>
              ))}
            </Alert>
          )}
          <FormGroup fieldId="userFullName" label={_("Full name")}>
            <TextInput
              id="userFullName"
              name="fullName"
              defaultValue={firstUser.fullName}
              onBlur={(e) => setSuggestions(suggestUsernames(e.target.value))}
            />
          </FormGroup>

          <FormGroup className="first-username-wrapper" fieldId="userName" label={_("Username")}>
            <TextInput
              id="userName"
              name="userName"
              ref={usernameInputRef}
              defaultValue={firstUser.userName}
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
          {isEditing && (
            <Switch
              label={_("Edit the password too")}
              isChecked={changePassword}
              onChange={() => setChangePassword(!changePassword)}
            />
          )}
          {changePassword && (
            <PasswordAndConfirmationInput inputRef={passwordRef} showErrors={false} />
          )}
          <ActionGroup>
            <Page.Submit form="firstUserForm" />
            <Page.Cancel />
          </ActionGroup>
        </Form>
      </Page.Content>
    </Page>
  );
}
