/*
 * Copyright (c) [2023-2024] SUSE LLC
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

import React, { useEffect, useReducer, useRef, useState } from "react";
import {
  ActionGroup,
  Alert,
  Flex,
  Form,
  FormGroup,
  List,
  ListItem,
  Split,
  TextInput,
} from "@patternfly/react-core";
import { NestedContent, Page, PasswordInput, SwitchEnhanced } from "~/components/core";
import { isValidIp } from "~/utils/network";
import { isEmpty, pick } from "radashi";
import { _ } from "~/i18n";

/**
 * Represents the form state.
 */
type FormState = {
  address: string;
  port: string;
  username?: string;
  password?: string;
  reverseUsername?: string;
  reversePassword?: string;
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

// /**
//  * Supported form actions.
//  */
// type FormAction =
//   | { type: "SET_ADDRESS"; payload: FormState["address"] }
//   | { type: "SET_PORT"; payload: FormState["port"] }
//   | { type: "SET_USERNAME"; payload: FormState["username"] }
//   | { type: "SET_PASSWORD"; payload: FormState["password"] }
//   | { type: "SET_REVERSE_USERNAME"; payload: FormState["reverseUsername"] }
//   | { type: "SET_REVERSE_PASSWORD"; payload: FormState["reversePassword"] }
//
// /**
//  * Reducer for form state updates.
//  */
// const formReducer = (state: FormState, action: FormAction): FormState => {
//   const { type, payload} = action;
//
//   switch (type) {
//     case "SET_ADDRESS": {
//       return { ...state, address: payload };
//     }
//
//     case "SET_PORT": {
//       return { ...state, port: payload };
//     }
//
//     case "SET_USERNAME": {
//       return { ...state, username: payload };
//     }
//
//     case "SET_PASSWORD": {
//       return { ...state, password: payload };
//     }
//
//     case "SET_REVERSE_USERNAME": {
//       return { ...state, reverseUsername: payload };
//     }
//
//     case "SET_REVERSE_PASSWORD": {
//       return { ...state, reversePassword: payload };
//     }
//   }
// };
//

/**
 * Helper to create a change handler that infers the field from the input name.
 */
const handleInputChange =
  (dispatch: React.Dispatch<FormAction>) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const field = e.target.name as keyof FormState;

    dispatch({
      type: "SET_VALUE",
      field,
      payload: e.target.value,
    } as FormAction);
  };

export default function DiscoverForm() {
  const [state, dispatch] = useReducer(formReducer, {
    address: "",
    port: "",
    username: "",
    password: "",
    reverseUsername: "",
    reversePassword: "",
  });
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState([]);
  const [showAuth, setShowAuth] = useState(false);
  const [showMutualAuth, setShowMutualAuth] = useState(false);
  const alertRef = useRef(null);

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

    const fieldsToCheck: Array<keyof FormState> = ["address", "port"];

    showAuth && fieldsToCheck.push("username", "password");
    showAuth && showMutualAuth && fieldsToCheck.push("reverseUsername", "reversePassword");

    if (!isValidIp(state.address)) {
      nextErrors.push(_("No valid address."));
    }

    if (!Number.isInteger(parseInt(state.port))) {
      nextErrors.push(_("No valid port."));
    }

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

  return (
    <Form onSubmit={onSubmit}>
      {errors.length > 0 && (
        <div ref={alertRef}>
          <Alert variant="warning" isInline title={_("Something went wrong")}>
            <List>
              {errors.map((error, i) => (
                <ListItem key={`error_${i}`}>{error}</ListItem>
              ))}
            </List>
          </Alert>
        </div>
      )}
      <Flex>
        <FormGroup fieldId="address" label={_("IP address")}>
          <TextInput
            id="address"
            name="address"
            // TRANSLATORS: network address
            aria-label={_("Address")}
            value={state.address}
            label={_("Address")}
            onChange={onChange}
          />
        </FormGroup>
        <FormGroup fieldId="port" label={_("Port")}>
          <TextInput
            id="port"
            name="port"
            // TRANSLATORS: network port number
            aria-label={_("Port")}
            value={state.port}
            label={_("Port")}
            onChange={onChange}
          />
        </FormGroup>
      </Flex>
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
  );
}
