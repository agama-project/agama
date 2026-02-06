/*
 * Copyright (c) [2023-2026] SUSE LLC
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
import { useNavigate } from "react-router";
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
import { discoverISCSIAction } from "~/api";
import { STORAGE } from "~/routes/paths";
import { _ } from "~/i18n";

import type { DiscoverISCSIConfig } from "~/model/action";

/**
 * Generic action to set any field in the form state.
 * Uses mapped types to ensure type safety across all config fields.
 */
type SetValueFormAction = {
  [K in keyof DiscoverISCSIConfig]: {
    type: "SET_VALUE";
    field: K;
    payload: DiscoverISCSIConfig[K];
  };
}[keyof DiscoverISCSIConfig];

/** Initial state for the iSCSI discovery form.
 *
 * Also serves as a type reference for automatic value conversion in
 * handleInputChange.
 */
const initialState: DiscoverISCSIConfig = {
  address: "",
  port: 3260,
  username: "",
  password: "",
  initiatorUsername: "",
  initiatorPassword: "",
};

/**
 * Helper to create a change handler that infers the field from the input name.
 *
 * Automatically converts input values to match their expected types by checking
 * against the initialState. E.g., number fields are converted from strings to
 * numbers.
 */
const handleInputChange =
  (dispatch: React.Dispatch<SetValueFormAction>) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const field = e.target.name as keyof DiscoverISCSIConfig;
    const expectedType = typeof initialState[field];
    const value = expectedType === "number" ? Number(e.target.value) : e.target.value;

    dispatch({
      type: "SET_VALUE",
      field,
      payload: value,
    } as SetValueFormAction);
  };

/**
 * Reducer function for managing iSCSI discovery form state.
 */
const formReducer = (
  state: DiscoverISCSIConfig,
  action?: SetValueFormAction,
): DiscoverISCSIConfig => {
  const { type, field, payload } = action;

  switch (type) {
    case "SET_VALUE":
      return { ...state, [field]: payload };
    default:
      return state;
  }
};

/**
 * Form component for discovering iSCSI targets.
 *
 * Manages a kind of multi-step form where optional authentication fields are
 * conditionally rendered based on toggle switches upon user decision.
 */
function DiscoverForm() {
  const [state, dispatch] = useReducer(formReducer, initialState);
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState([]);
  const [showAuth, setShowAuth] = useState(false);
  const [showMutualAuth, setShowMutualAuth] = useState(false);
  const alertRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    // Scroll the alert into view
    if (errors.length > 0) {
      alertRef.current.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }
  }, [errors]);

  const onInputChange = handleInputChange(dispatch);

  const onSubmit = async (event) => {
    event.preventDefault();
    setIsLoading(true);
    setErrors([]);
    const nextErrors = [];

    const fieldsToCheck: Array<keyof DiscoverISCSIConfig> = ["address", "port"];

    showAuth && fieldsToCheck.push("username", "password");
    showAuth && showMutualAuth && fieldsToCheck.push("initiatorUsername", "initiatorPassword");

    const config: DiscoverISCSIConfig = pick(state, fieldsToCheck);

    if (!isValidIp(state.address)) {
      nextErrors.push(_("No valid address."));
    }

    if (!Number.isInteger(state.port)) {
      nextErrors.push(_("No valid port."));
    }

    if (Object.values(config).some((v) => isEmpty(v))) {
      nextErrors.push(_("All fields are required."));
    }

    if (nextErrors.length > 0) {
      setErrors(nextErrors);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    discoverISCSIAction(config);
    navigate({ pathname: STORAGE.iscsi.root });
  };

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
        <FormGroup fieldId="address" label={_("Address")}>
          <TextInput id="address" name="address" value={state.address} onChange={onInputChange} />
        </FormGroup>
        <FormGroup fieldId="port" label={_("Port")}>
          <TextInput id="port" name="port" value={state.port} onChange={onInputChange} />
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
                value={state.username}
                onChange={onInputChange}
              />
            </FormGroup>
            <FormGroup fieldId="password" label={_("Password")}>
              <PasswordInput
                id="password"
                name="password"
                value={state.password}
                onChange={onInputChange}
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
              <FormGroup fieldId="initiatorUsername" label={_("Initiator user name")}>
                <TextInput
                  id="initiatorUsername"
                  name="initiatorUsername"
                  value={state.initiatorUsername}
                  onChange={onInputChange}
                />
              </FormGroup>
              <FormGroup fieldId="initiatorPassword" label={_("Initiator password")}>
                <PasswordInput
                  id="initiatorPassword"
                  name="initiatorPassword"
                  value={state.initiatorPassword}
                  onChange={onInputChange}
                />
              </FormGroup>
            </Split>
          )}
        </NestedContent>
      )}

      <ActionGroup>
        <Page.Submit isLoading={isLoading} />
        {!isLoading && <Page.Back>{_("Cancel")}</Page.Back>}
      </ActionGroup>
    </Form>
  );
}

/**
 * Page wrapper for the iSCSI discovery form.
 *
 * Provides page layout with breadcrumb navigation for the discover targets
 * workflow.
 */
export default function DiscoverFormPage() {
  return (
    <Page
      breadcrumbs={[
        { label: _("Storage"), path: STORAGE.root },
        { label: _("iSCSI"), path: STORAGE.iscsi.root },
        { label: _("Discover targets") },
      ]}
    >
      <Page.Content>
        <DiscoverForm />
      </Page.Content>
    </Page>
  );
}
