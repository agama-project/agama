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
  TextInput,
} from "@patternfly/react-core";
import { PasswordInput } from "~/components/core";
import { useAddConnectionMutation, useNetworkConfigChanges } from "~/queries/network";
import { _ } from "~/i18n";
import { Connection, Wireless } from "~/types/network";

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

const securityFrom = (supported) => {
  if (supported.includes("WPA2")) return "wpa-psk";
  if (supported.includes("WPA1")) return "wpa-psk";
  return "";
};

export default function WifiConnectionForm({ network, onCancel }) {
  const { mutate: addConnection } = useAddConnectionMutation();
  const [error, setError] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [ssid, setSsid] = useState(network?.ssid || "");
  const [password, setPassword] = useState(network?.password || "");
  const [security, setSecurity] = useState(securityFrom(network?.security || []));
  const hidden = network?.hidden || false;

  useNetworkConfigChanges();

  const accept = async (e) => {
    e.preventDefault();
    setError(false);
    setIsConnecting(true);

    const wireless = new Wireless({ ssid, security, password, hidden });
    const connection = new Connection(ssid, { wireless });
    addConnection(connection);
  };

  return (
    <Form id={`${ssid}-connection-form`} onSubmit={accept}>
      {error && (
        <Alert variant="warning" isInline title={_("Something went wrong")}>
          <p>{_("Please, review provided settings and try again.")}</p>
        </Alert>
      )}

      {network?.hidden && (
        // TRANSLATORS: SSID (Wifi network name) configuration
        <FormGroup fieldId="ssid" label={_("SSID")}>
          <TextInput id="ssid" name="ssid" value={ssid} onChange={(_, value) => setSsid(value)} />
        </FormGroup>
      )}

      {/* TRANSLATORS: Wifi security configuration (password protected or not) */}
      <FormGroup fieldId="security" label={_("Security")}>
        <FormSelect
          id="security"
          aria-label={_("Security")}
          value={security}
          onChange={(_, value) => setSecurity(value)}
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
            onChange={(_, value) => setPassword(value)}
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
