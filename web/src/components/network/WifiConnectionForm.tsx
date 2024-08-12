/*
 * Copyright (c) [2022-2024] SUSE LLC
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

import React, { useState } from "react";
import {
  ActionGroup,
  Alert,
  Button,
  Form,
  FormGroup,
  FormSelect,
  FormSelectOption,
  FormSelectProps,
  TextInput,
} from "@patternfly/react-core";
import { PasswordInput } from "~/components/core";
import {
  useAddConnectionMutation,
  useConnectionMutation,
  useSelectedWifiChange,
} from "~/queries/network";
import { Connection, WifiNetwork, Wireless } from "~/types/network";
import sprintf from "sprintf-js";
import { _ } from "~/i18n";

/*
 * FIXME: it should be moved to the SecurityProtocols enum that already exists or to a class based
 * enum pattern in the network_manager adapter.
 */
const security_options = [
  // TRANSLATORS: WiFi authentication mode
  { value: "", label: _("None") },
  // TRANSLATORS: WiFi authentication mode
  { value: "wpa-psk", label: _("WPA & WPA2 Personal") },
];

const selectorOptions = security_options.map((security) => (
  <FormSelectOption key={security.value} value={security.value} label={security.label} />
));

// FIXME: improve error handling. The errors props shuld have a key/value error
//  and the component should show all of them, if any
export default function WifiConnectionForm({
  network,
  errors = {},
  onCancel,
}: {
  network: WifiNetwork;
  errors?: object;
  onCancel: () => void;
}) {
  const settings = network.settings?.wireless || new Wireless();
  const { mutate: addConnection } = useAddConnectionMutation();
  const { mutate: updateConnection } = useConnectionMutation();
  const { mutate: updateSelectedNetwork } = useSelectedWifiChange();
  const [ssid, setSsid] = useState<string>(settings.ssid);
  const [security, setSecurity] = useState<string>(settings.security);
  const [password, setPassword] = useState<string>(settings.password);
  const [showErrors, setShowErrors] = useState<boolean>(Object.keys(errors).length > 0);
  const [isConnecting, setIsConnecting] = useState<boolean>(false);
  const hidden = network?.hidden || false;

  const accept = async (e) => {
    e.preventDefault();
    setShowErrors(false);
    setIsConnecting(true);
    updateSelectedNetwork({ ssid, needsAuth: null });
    const connection = network.settings || new Connection(ssid);
    connection.wireless = new Wireless({ ssid, security, password, hidden });
    const action = network.settings ? updateConnection : addConnection;
    action(connection);
  };

  return (
    /** TRANSLATORS: accessible name for the WiFi connection form */
    <Form onSubmit={accept} aria-label={_("WiFi connection form")}>
      {showErrors && (
        <Alert
          variant="warning"
          isInline
          title={
            // @ts-expect-error
            errors.needsAuth
              ? _("Authentication failed, please try again")
              : _("Something went wrong")
          }
        >
          {/** @ts-expect-error */}
          {!errors.needsAuth && <p>{_("Please, review provided settings and try again.")}</p>}
        </Alert>
      )}

      {hidden && (
        // TRANSLATORS: SSID (Wifi network name) configuration
        <FormGroup fieldId="ssid" label={_("SSID")}>
          <TextInput id="ssid" name="ssid" value={ssid} onChange={(_, v) => setSsid(v)} />
        </FormGroup>
      )}

      {/* TRANSLATORS: Wifi security configuration (password protected or not) */}
      <FormGroup fieldId="security" label={_("Security")}>
        <FormSelect
          id="security"
          aria-label={_("Security")}
          value={security}
          onChange={(_, v) => setSecurity(v)}
        >
          {selectorOptions}
        </FormSelect>
      </FormGroup>
      {security === "wpa-psk" && (
        // TRANSLATORS: WiFi password
        <FormGroup fieldId="password" label={_("WPA Password")}>
          <PasswordInput
            id="password"
            name="password"
            aria-label={_("Password")}
            value={password}
            onChange={(_, v) => setPassword(v)}
          />
        </FormGroup>
      )}
      <ActionGroup>
        <Button type="submit" variant="primary" isLoading={isConnecting} isDisabled={isConnecting}>
          {/* TRANSLATORS: button label, connect to a WiFi network */}
          {_("Connect")}
        </Button>
        {/* TRANSLATORS: button label */}
        <Button variant="link" isDisabled={isConnecting} onClick={onCancel}>
          {_("Cancel")}
        </Button>
      </ActionGroup>
    </Form>
  );
}
