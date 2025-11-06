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
import { useConnection, useConfigMutation, useNetworkDevices } from "~/queries/network";
import { Connection, ConnectionBindingMode, Device } from "~/types/network";
import { Config } from "~/types/config";
import Radio from "~/components/core/RadioEnhanced";
import { sprintf } from "sprintf-js";
import { _ } from "~/i18n";
import { connectionBindingMode } from "~/utils/network";
import { useNetworkProposal } from "~/queries/proposal";

type DevicesSelectProps = Omit<FormSelectProps, "children" | "ref"> & {
  /**
   * The key from the device object whose value should be used for a select value
   */
  valueKey: keyof Device;
};

/**
 * A specialized `FormSelect` component for displaying and selecting network
 * devices.
 *
 * The options' labels are formatted as "Device Name - MAC Address" or "MAC
 * Address - Device Name" based on the `valueKey` prop, ensuring both key
 * identifiers are visible.
 */
function DevicesSelect({
  value,
  valueKey,
  ...formSelectProps
}: DevicesSelectProps): React.ReactNode {
  const devices = useNetworkDevices();

  const labelAttrs = valueKey === "macAddress" ? ["macAddress", "name"] : ["name", "macAddress"];

  return (
    <FormSelect value={value} {...formSelectProps}>
      {devices.map((device, index) => {
        // TRANSLATORS: A label shown in a dropdown for selecting a network
        // device. It combines the device name and MAC address, with the order
        // determined by the component settings: some selectors will show the
        // name first, others the MAC address. I.e. "enp1s0 - CC-7F-C8-FC-7A-A1"
        // or "CC-7F-C8-FC-7A-A1 - enp1s0". You may change the separator, but
        // please keep both %s placeholders.
        const label = sprintf(_("%s - %s"), device[labelAttrs[0]], device[labelAttrs[1]]);
        return <FormSelectOption key={index} value={device[valueKey]} label={label} />;
      })}
    </FormSelect>
  );
}

/**
 * Represents the form state.
 */
type FormState = {
  mode: ConnectionBindingMode;
  /** The selected interface name for "iface" mode */
  iface: Device["name"];
  /** The selected MAC address for "mac" mode */
  mac: Device["macAddress"];
};

/**
 * Supported form actions.
 */
type FormAction =
  | { type: "SET_MODE"; mode: FormState["mode"] }
  | { type: "SET_IFACE"; iface: FormState["iface"] }
  | { type: "SET_MAC"; mac: FormState["mac"] };

/**
 * Reducer for form state updates.
 */
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

/**
 * Allows to configure how a network connection is associated with a specific
 * network interface.
 *
 * Users can choose to bind by interface name, MAC address, or allow the
 * connection on any interface.
 */
export default function BindingSettingsForm() {
  const proposal = useNetworkProposal();
  const { id } = useParams();
  const { mutateAsync: updateConfig } = useConfigMutation();
  const connection = useConnection(id);
  const devices = useNetworkDevices();
  const navigate = useNavigate();
  const [state, dispatch] = useReducer(formReducer, {
    mode: connectionBindingMode(connection),
    mac: connection.macAddress || devices[0].macAddress,
    iface: connection.iface || devices[0].name,
  });

  const onSubmitForm = (e) => {
    e.preventDefault();

    const { id, ...connectionOptions } = connection;

    const updatedConnection = new Connection(id, {
      ...connectionOptions,
      iface: state.mode === "iface" ? state.iface : undefined,
      macAddress: state.mode === "mac" ? state.mac : undefined,
    });

    proposal.addOrUpdateConnection(updatedConnection);
    const config: Config = { network: proposal.toApi() };

    updateConfig(config)
      .then(() => navigate(-1))
      .catch(console.error);
  };

  // TRANSLATORS: The title of the page. %s will be replaced with the connection
  // name. I.e., "Binding settings for 'Wired connection 1'"
  const title = sprintf(_("Binding settings for '%s'"), connection.id);

  return (
    <Page>
      <Page.Header>
        <Content component="h2">{title}</Content>
        <SubtleContent>
          {_(
            "Choose how the connection should be associated with a network device. This helps control which device the connection uses.",
          )}
        </SubtleContent>
      </Page.Header>

      <Page.Content>
        <Form id="editDeviceConnectionForm" onSubmit={onSubmitForm}>
          <FormGroup fieldId="macAddress" isStack>
            <Radio
              id="binding-mode-none"
              name="binding-mode"
              label={_("Unbound")}
              body={
                <SubtleContent>
                  {_("The connection can be used by any available device.")}
                </SubtleContent>
              }
              isChecked={state.mode === "none"}
              onChange={() => dispatch({ type: "SET_MODE", mode: "none" })}
            />
            <Radio
              id="binding-mode-iface"
              name="binding-mode"
              label={_("Bind to device name")}
              body={
                <Stack hasGutter>
                  <DevicesSelect
                    aria-label={_("Choose device to bind by name")}
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
                    aria-label={_("Choose device to bind by MAC")}
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
