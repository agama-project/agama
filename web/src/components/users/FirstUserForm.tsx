/*
 * Copyright (c) [2022-2026] SUSE LLC
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
  Content,
  ActionGroup,
  Button,
} from "@patternfly/react-core";
import { useNavigate } from "react-router";
import { PasswordAndConfirmationInput, Page } from "~/components/core";
import { suggestUsernames } from "~/components/users/utils";
import { useConfig } from "~/hooks/model/config";
import { patchConfig } from "~/api";
import type { User } from "~/model/config";
import { _ } from "~/i18n";
import { USER } from "~/routes/paths";

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
  const { user: firstUser } = useConfig();
  const [usingHashedPassword, setUsingHashedPassword] = useState(
    firstUser ? firstUser.hashedPassword : false,
  );
  const [fullName, setFullName] = useState(firstUser?.fullName || "");
  const [userName, setUserName] = useState(firstUser?.userName || "");
  const [password, setPassword] = useState(usingHashedPassword ? "" : firstUser?.password || "");
  const [errors, setErrors] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [insideDropDown, setInsideDropDown] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const [suggestions, setSuggestions] = useState([]);
  const navigate = useNavigate();
  const passwordRef = useRef<HTMLInputElement>();

  useEffect(() => {
    if (showSuggestions) {
      setFocusedIndex(-1);
    }
  }, [showSuggestions]);

  const isEditing = firstUser?.userName !== "";

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErrors([]);
    const nextErrors = [];
    const passwordInput = passwordRef.current;

    const data: User.Config = {
      fullName,
      userName,
      password: usingHashedPassword ? firstUser?.password : password,
      hashedPassword: usingHashedPassword,
    };

    const requiredData = { ...data };

    if (Object.values(requiredData).some((v) => v === "")) {
      nextErrors.push(_("All fields are required"));
    }

    if (!usingHashedPassword) {
      data.hashedPassword = false;
      !passwordInput?.validity.valid && nextErrors.push(passwordInput?.validationMessage);
    }

    if (nextErrors.length > 0) {
      setErrors(nextErrors);
      return;
    }

    patchConfig({ user: data })
      .then(() => navigate(".."))
      .catch((e) => setErrors([e.response.data]));
  };

  const onSuggestionSelected = (suggestion: string) => {
    setUserName(suggestion);
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
    <Page
      breadcrumbs={[
        { label: _("Authentication"), path: USER.root },
        { label: isEditing ? _("Edit user") : _("Create user") },
      ]}
    >
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
              value={fullName}
              onChange={(_, value) => setFullName(value)}
              onBlur={(e) => setSuggestions(suggestUsernames(e.target.value))}
            />
          </FormGroup>
          <FormGroup className="first-username-wrapper" fieldId="userName" label={_("Username")}>
            <TextInput
              id="userName"
              name="userName"
              value={userName}
              isRequired
              onChange={(_, value) => setUserName(value)}
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
          {usingHashedPassword && (
            <Content isEditorial>
              {_("Using a hashed password.")}{" "}
              <Button variant="link" isInline onClick={() => setUsingHashedPassword(false)}>
                {_("Change")}
              </Button>
            </Content>
          )}
          {!usingHashedPassword && (
            <>
              <PasswordAndConfirmationInput
                inputRef={passwordRef}
                value={password}
                showErrors={false}
                onChange={(_, value) => setPassword(value)}
              />
            </>
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
