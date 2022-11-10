/*
 * Copyright (c) [2022] SUSE LLC
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
  TextInput
} from "@patternfly/react-core";
import { useInstallerClient } from "./context/installer";

const security_options = [
  { value: "", label: "None" },
  { value: "wpa-psk", label: "WPA & WPA2 Personal" },
  { value: "wpa-eap", label: "WPA & WPA2 Enterprise" }
];

const selectorOptions = security_options.map(security => (
  <FormSelectOption key={security.value} value={security.value} label={security.label} />
));

export default function WifiConnectionForm({ network, onCancel }) {
  const client = useInstallerClient();
  const [error, setError] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [ssid, setSsid] = useState(network?.ssid);
  const [password, setPassword] = useState("");
  const [security, setSecurity] = useState("none");

  const accept = async e => {
    e.preventDefault();
    setError(false);
    setIsConnecting(true);

    client.network.addAndConnectTo(ssid, { security, password })
      .then(() => console.log("Connected successfully to", network))
      .catch(() => {
        setError(true);
      })
      .finally(() => setIsConnecting(false));
  };

  return (
    <Form id={`${ssid}-connection-form`} onSubmit={accept}>
      { error &&
        <Alert variant="warning" isInline title="Something went wrong">
          <p>Please, review provided settings and try again.</p>
        </Alert> }

      { network?.hidden &&
        <FormGroup fieldId="ssid" label="SSID">
          <TextInput
            id="ssid"
            name="ssid"
            label="SSID"
            aria-label="ssid"
            value={ssid}
            onChange={setSsid}
          />
        </FormGroup> }

      <FormGroup fieldId="security" label="Security">
        <FormSelect
          id="security"
          aria-label="security"
          value={security}
          onChange={setSecurity}
        >
          {selectorOptions}
        </FormSelect>
      </FormGroup>
      { security === "wpa-psk" &&
        <FormGroup fieldId="password" label="WPA Password">
          <TextInput
            id="password"
            name="password"
            aria-label="Password"
            value={password}
            label="Password"
            onChange={setPassword}
          />
        </FormGroup> }
      <ActionGroup>
        <Button type="submit" variant="primary" isLoading={isConnecting} isDisabled={isConnecting}>
          Connect
        </Button>
        <Button variant="link" isDisabled={isConnecting} onClick={onCancel}>Cancel</Button>
      </ActionGroup>
    </Form>
  );
}
