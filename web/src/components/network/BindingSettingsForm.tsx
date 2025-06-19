/*
 * Copyright (c) [2025] SUSE LLC
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

import React, { useReducer } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ActionGroup,
  Content,
  Form,
  FormGroup,
  FormSelect,
  FormSelectOption,
  FormSelectProps,
  Stack,
} from "@patternfly/react-core";
import { Page, SubtleContent } from "~/components/core";
import { sprintf } from "sprintf-js";
import { useConnection, useConnectionMutation, useNetworkDevices } from "~/queries/network";
import { _ } from "~/i18n";
import { Connection, Device } from "~/types/network";
import Radio from "~/components/core/RadioEnhanced";

type DevicesSelectProps = Omit<FormSelectProps, "children" | "ref"> & {
  valueKey: keyof Device;
};
function DevicesSelect({
  value,
  valueKey,
  ...formSelectProps
}: DevicesSelectProps): React.ReactNode {
  const devices = useNetworkDevices();

  const labelAttributes =
    valueKey === "macAddress" ? ["macAddress", "name"] : ["name", "macAddress"];

  return (
    <FormSelect value={value} {...formSelectProps}>
      {devices.map((device, index) => (
        <FormSelectOption
          key={index}
          value={device[valueKey]}
          label={labelAttributes.map((attr) => device[attr]).join(" - ")}
        />
      ))}
    </FormSelect>
  );
}

/**
 * Represents the form state.
 */
type FormState = {
  mode: "none" | "mac" | "iface";
  iface: Device["name"];
  mac: Device["macAddress"];
};

/**
 * Supported form actions.
 */
type FormAction =
  | { type: "SET_MODE"; mode: FormState["mode"] }
  | { type: "SET_IFACE"; iface: FormState["iface"] }
  | { type: "SET_MAC"; mac: FormState["mac"] };

const formReducer = (state: FormState, action: FormAction): FormState => {
  switch (action.type) {
    case "SET_MODE": {
      return { ...state, mode: action.mode };
    }

    case "SET_IFACE": {
      return { ...state, iface: action.iface };
    }

    case "SET_MAC": {
      return { ...state, mac: action.mac };
    }
  }
};

const initialMode = (connection: Connection): FormState["mode"] => {
  if (connection.macAddress) {
    return "mac";
  } else if (connection.iface) {
    return "iface";
  } else {
    return "none";
  }
};

export default function BindingSettingsForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { mutateAsync: updateConnection } = useConnectionMutation();
  const connection = useConnection(id);
  const [state, dispatch] = useReducer(formReducer, {
    mode: initialMode(connection),
    mac: connection.macAddress,
    iface: connection.iface,
  });

  const onSubmitForm = (e) => {
    e.preventDefault();

    const updatedConnection = new Connection(connection.id, {
      iface: state.mode === "iface" ? state.iface : undefined,
      macAddress: state.mode === "mac" ? state.mac : undefined,
    });

    updateConnection(updatedConnection)
      .then(() => navigate(-1))
      .catch(console.error);
  };

  return (
    <Page>
      <Page.Header>
        <Content component="h2">{sprintf(_("Binding settings for '%s'"), connection.id)}</Content>
        <SubtleContent>
          {_(
            "Choose how the connection should be associated with a network interface. This helps control which interface the connection uses.",
          )}
        </SubtleContent>
      </Page.Header>

      <Page.Content>
        <Form id="editDeviceConnectionForm" onSubmit={onSubmitForm}>
          <FormGroup fieldId="macAddress" isStack>
            <Radio
              id="binding-mode-none"
              name="binding-mode"
              label={_("Any interface")}
              body={
                <SubtleContent>
                  {_("The connection can be used by any available interface.")}
                </SubtleContent>
              }
              isChecked={state.mode === "none"}
              onChange={() => dispatch({ type: "SET_MODE", mode: "none" })}
            />
            <Radio
              id="binding-mode-iface"
              name="binding-mode"
              label={_("Bind to interface name")}
              body={
                <Stack hasGutter>
                  <DevicesSelect
                    aria-label={_("Available newtwork devices")}
                    valueKey="name"
                    value={state.iface}
                    name="device-limit-name"
                    isDisabled={state.mode !== "iface"}
                    onChange={(_, iface) => dispatch({ type: "SET_IFACE", iface })}
                  />
                </Stack>
              }
              isChecked={state.mode === "iface"}
              onChange={() => dispatch({ type: "SET_MODE", mode: "iface" })}
            />
            <Radio
              id="binding-mode-mac"
              name="binding-mode"
              label={_("Bind to MAC address")}
              body={
                <Stack hasGutter>
                  <DevicesSelect
                    aria-label={_("Available newtwork devices")}
                    valueKey="macAddress"
                    value={state.mac}
                    name="mac-limit-name"
                    isDisabled={state.mode !== "mac"}
                    onChange={(_, mac) => dispatch({ type: "SET_MAC", mac })}
                  />
                </Stack>
              }
              isChecked={state.mode === "mac"}
              onChange={() => dispatch({ type: "SET_MODE", mode: "mac" })}
            />
          </FormGroup>

          <ActionGroup>
            <Page.Submit form="editDeviceConnectionForm" />
            <Page.Back>{_("Cancel")}</Page.Back>
          </ActionGroup>
        </Form>
      </Page.Content>
    </Page>
  );
}
