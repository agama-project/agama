/*
 * Copyright (c) [2026] SUSE LLC
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

import React, { useEffect, useReducer, useState, useRef } from "react";
import { useParams } from "react-router";
import { isEmpty, pick } from "radashi";
import {
  ActionGroup,
  Alert,
  Form,
  FormGroup,
  FormSelect,
  FormSelectOption,
  List,
  ListItem,
  Split,
  TextInput,
} from "@patternfly/react-core";
import { NestedContent, Page, PasswordInput, SwitchEnhanced } from "~/components/core";
import { NodeStartupOptions } from "~/components/storage/iscsi";
import { STORAGE } from "~/routes/paths";
import { _ } from "~/i18n";

/**
 * Represents the form state.
 */
type FormState = {
  username?: string;
  password?: string;
  reverseUsername?: string;
  reversePassword?: string;
  startup: "onboot" | "manual" | "auto";
};

/**
 * Generic action to set any field in the form state.
 */
type SetValueAction = {
  [K in keyof FormState]: {
    type: "SET_VALUE";
    field: K;
    payload: FormState[K];
  };
}[keyof FormState];

type FormAction = SetValueAction;

const formReducer = (state: FormState, action: FormAction): FormState => {
  const { type, field, payload } = action;

  switch (type) {
    case "SET_VALUE":
      return { ...state, [field]: payload };
    default:
      return state;
  }
};

/**
 * Helper to create a change handler that infers the field from the input name.
 */
const handleInputChange =
  (dispatch: React.Dispatch<FormAction>) =>
  (e: React.FormEvent<HTMLInputElement | HTMLSelectElement>) => {
    const target = e.target as HTMLFormElement;
    const field = target.name as keyof FormState;

    dispatch({
      type: "SET_VALUE",
      field,
      payload: target.value,
    } as FormAction);
  };

export default function TargetLoginPage() {
  const alertRef = useRef(null);
  const { id } = useParams();
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState([]);
  const [showAuth, setShowAuth] = useState(false);
  const [showMutualAuth, setShowMutualAuth] = useState(false);
  const [state, dispatch] = useReducer(formReducer, {
    username: "",
    password: "",
    reverseUsername: "",
    reversePassword: "",
    startup: "onboot",
  });

  useEffect(() => {
    // Scroll the alert into view
    if (errors.length > 0) {
      alertRef.current.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }
  }, [errors]);

  const onSubmit = async (event) => {
    event.preventDefault();
    setIsLoading(true);
    setErrors([]);
    const nextErrors = [];

    const fieldsToCheck: Array<keyof FormState> = ["startup"];

    showAuth && fieldsToCheck.push("username", "password");
    showAuth && showMutualAuth && fieldsToCheck.push("reverseUsername", "reversePassword");

    if (Object.values(pick(state, fieldsToCheck)).some((v) => isEmpty(v))) {
      nextErrors.push(_("All fields are required."));
    }

    if (nextErrors.length > 0) {
      setErrors(nextErrors);
      setIsLoading(false);
      return;
    }

    console.log(
      "FIXME: sent data and navigate somewhere, maybe back, with useNavigate, navigate('path')",
    );
  };

  const onChange = handleInputChange(dispatch);

  const startupFormOptions = Object.values(NodeStartupOptions).map((option, i) => (
    <FormSelectOption key={i} value={option.value} label={_(option.label)} />
  ));

  return (
    <Page
      breadcrumbs={[
        { label: _("Storage"), path: STORAGE.root },
        { label: _("iSCSI"), path: STORAGE.iscsi.root },
        { label: id },
        { label: _("Login") },
      ]}
    >
      <Page.Content>
        <Form onSubmit={onSubmit}>
          {errors.length > 0 && (
            <div ref={alertRef}>
              <Alert variant="warning" isInline title={_("Something went wrong")}>
                <List>
                  {errors.map((error) => (
                    <ListItem>{error}</ListItem>
                  ))}
                </List>
              </Alert>
            </div>
          )}
          {/* TRANSLATORS: iSCSI start up mode (on boot/manual/automatic) */}
          <FormGroup fieldId="startup" label={_("Startup")}>
            <FormSelect
              id="startup"
              name="startup"
              aria-label={_("Startup")}
              value={state.startup}
              onChange={onChange}
            >
              {startupFormOptions}
            </FormSelect>
          </FormGroup>
          <SwitchEnhanced
            id="useAuth"
            label={_("Provide authentication")}
            description={_("Lorem ipsum dolor")}
            isChecked={showAuth}
            onChange={() => setShowAuth(!showAuth)}
          />
          {showAuth && (
            <NestedContent>
              <Split hasGutter>
                <FormGroup fieldId="username" label={_("User name")}>
                  <TextInput
                    id="username"
                    name="username"
                    aria-label={_("User name")}
                    value={state.username}
                    label={_("User name")}
                    onChange={onChange}
                  />
                </FormGroup>
                <FormGroup fieldId="password" label={_("Password")}>
                  <PasswordInput
                    id="password"
                    name="password"
                    aria-label={_("Password")}
                    value={state.password}
                    onChange={onChange}
                  />
                </FormGroup>
              </Split>

              <SwitchEnhanced
                id="useMutualAuth"
                label={_("Enable mutual verification")}
                description={_("Allow both sides verify each other's identity")}
                isChecked={showMutualAuth}
                onChange={() => setShowMutualAuth(!showMutualAuth)}
              />
              {showMutualAuth && (
                <Split hasGutter>
                  <FormGroup fieldId="reverseUsername" label={_("User name")}>
                    <TextInput
                      id="reverseUsername"
                      name="reverseUsername"
                      aria-label={_("User name")}
                      value={state.reverseUsername}
                      label={_("User name")}
                      onChange={onChange}
                    />
                  </FormGroup>
                  <FormGroup fieldId="reversePassword" label="Password">
                    <PasswordInput
                      id="reversePassword"
                      name="reversePassword"
                      aria-label={_("Target Password")}
                      value={state.reversePassword}
                      onChange={onChange}
                    />
                  </FormGroup>
                </Split>
              )}
            </NestedContent>
          )}

          <ActionGroup>
            <Page.Submit />
            {!isLoading && <Page.Back>{_("Cancel")}</Page.Back>}
          </ActionGroup>
        </Form>
      </Page.Content>
    </Page>
  );
}
