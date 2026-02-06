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
import { useParams, useNavigate } from "react-router";
import { isEmpty, pick } from "radashi";
import { sprintf } from "sprintf-js";
import {
  ActionGroup,
  Alert,
  DescriptionList,
  DescriptionListDescription,
  DescriptionListGroup,
  DescriptionListTerm,
  Form,
  FormGroup,
  FormSelect,
  FormSelectOption,
  List,
  ListItem,
  Split,
  TextInput,
} from "@patternfly/react-core";
import Page from "~/components/core/Page";
import NestedContent from "~/components/core/NestedContent";
import PasswordInput from "~/components/core/PasswordInput";
import ResourceNotFound from "~/components/core/ResourceNotFound";
import SwitchEnhanced from "~/components/core/SwitchEnhanced";
import { useSystem } from "~/hooks/model/system/iscsi";
import { useAddOrEditTarget, useConfig } from "~/hooks/model/config/iscsi";
import { STORAGE } from "~/routes/paths";
import { N_, _ } from "~/i18n";

import type { Target as ConfigTarget, Authentication } from "~/openapi/config/iscsi";

export const StartupOptions = Object.freeze({
  MANUAL: { label: N_("Manual"), value: "manual" },
  ONBOOT: { label: N_("On boot"), value: "onboot" },
  AUTOMATIC: { label: N_("Automatic"), value: "automatic" },
});

/**
 * Represents the form state.
 */
type FormState = {
  username?: Authentication["username"];
  password?: Authentication["password"];
  reverseUsername?: Authentication["username"];
  reversePassword?: Authentication["password"];
  startup: ConfigTarget["startup"];
};

/**
 * Generic action to set any field in the form state.
 */
type SetValueFormAction = {
  [K in keyof FormState]: {
    type: "SET_VALUE";
    field: K;
    payload: FormState[K];
  };
}[keyof FormState];

const formReducer = (state: FormState, action?: SetValueFormAction): FormState => {
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
  (dispatch: React.Dispatch<SetValueFormAction>) =>
  (e: React.FormEvent<HTMLInputElement | HTMLSelectElement>) => {
    const target = e.target as HTMLFormElement;
    const field = target.name as keyof FormState;

    dispatch({
      type: "SET_VALUE",
      field,
      payload: target.value,
    });
  };

function TargetLoginForm({ target }): React.ReactNode {
  const alertRef = useRef(null);
  const addOrEditTarget = useAddOrEditTarget();
  const navigate = useNavigate();
  const [state, dispatch] = useReducer(formReducer, {
    username: target.authByTarget?.username || "",
    password: target.authByTarget?.password || "",
    reverseUsername: target.authByInitiator?.username || "",
    reversePassword: target.authByInitiator?.password || "",
    startup: target.startup || "onboot",
  });
  const [showAuth, setShowAuth] = useState(!isEmpty(state.username));
  const [showMutualAuth, setShowMutualAuth] = useState(!isEmpty(state.reverseUsername));
  const [errors, setErrors] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

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

    const authByTarget = showAuth
      ? { username: state.username, password: state.password }
      : undefined;
    const authByInitiator =
      showAuth && showMutualAuth
        ? { username: state.reverseUsername, password: state.reversePassword }
        : undefined;

    const targetConfig: ConfigTarget = {
      name: target.name,
      address: target.address,
      port: target.port,
      interface: target.interface,
      startup: state.startup,
      authByTarget,
      authByInitiator,
    };
    addOrEditTarget(targetConfig);
    navigate({ pathname: STORAGE.iscsi.root });
  };

  const onChange = handleInputChange(dispatch);

  const startupFormOptions = Object.values(StartupOptions).map((option, i) => (
    /* eslint-disable agama-i18n/string-literals */
    <FormSelectOption key={i} value={option.value} label={_(option.label)} />
  ));

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

      <DescriptionList isCompact>
        <DescriptionListGroup>
          <DescriptionListTerm>{_("Target")}</DescriptionListTerm>
          <DescriptionListDescription>{target.name}</DescriptionListDescription>
        </DescriptionListGroup>
        <DescriptionListGroup>
          <DescriptionListTerm>{_("Portal")}</DescriptionListTerm>
          <DescriptionListDescription>
            {`${target.address}:${target.port}`}
          </DescriptionListDescription>
        </DescriptionListGroup>
      </DescriptionList>

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
              <TextInput id="username" name="username" value={state.username} onChange={onChange} />
            </FormGroup>
            <FormGroup fieldId="password" label={_("Password")}>
              <PasswordInput
                id="password"
                name="password"
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
              <FormGroup fieldId="reverseUsername" label={_("Initiator user name")}>
                <TextInput
                  id="reverseUsername"
                  name="reverseUsername"
                  value={state.reverseUsername}
                  onChange={onChange}
                />
              </FormGroup>
              <FormGroup fieldId="reversePassword" label="Initiator password">
                <PasswordInput
                  id="reversePassword"
                  name="reversePassword"
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

export default function TargetLoginPage() {
  const { name, address, port } = useParams();
  const config = useConfig();
  const system = useSystem();

  const systemTarget = system?.targets?.find(
    (t) => t.name === name && t.address === address && t.port === Number(port),
  );

  const configTarget = config?.targets?.find(
    (t) => t.name === name && t.address === address && t.port === Number(port),
  );

  const target = { ...systemTarget, ...configTarget };

  return (
    <Page
      breadcrumbs={[
        { label: _("Storage"), path: STORAGE.root },
        { label: _("iSCSI"), path: STORAGE.iscsi.root },
        { label: _("Login") },
      ]}
    >
      <Page.Content>
        {isEmpty(target) ? (
          <ResourceNotFound
            title={_("Target not found")}
            body={sprintf(
              _("%s at portal %s does not exist or cannot be reached."),
              name,
              `${address}:${port}`,
            )}
            linkText={_("Go to iSCSI")}
            linkPath={STORAGE.iscsi.root}
          />
        ) : (
          <TargetLoginForm target={target} />
        )}
      </Page.Content>
    </Page>
  );
}
