/*
 * Copyright (c) [2022-2024] SUSE LLC
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

import React, { useEffect, useState } from "react";
import {
  ActionGroup,
  Alert,
  Button,
  Form,
  FormGroup,
  FormSelect,
  FormSelectOption,
} from "@patternfly/react-core";
import { PasswordInput } from "~/components/core";
import { useAddConnectionMutation, useConnectionMutation } from "~/queries/network";
import { Connection, DeviceState, WifiNetwork, Wireless } from "~/types/network";
import { _ } from "~/i18n";
import { sprintf } from "sprintf-js";
import { useNavigate } from "react-router-dom";

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

const securityFrom = (supported: string[]) => {
  if (supported.includes("WPA2")) return "wpa-psk";
  if (supported.includes("WPA1")) return "wpa-psk";
  return "";
};

const ConnectionError = ({ ssid }) => (
  <Alert variant="warning" isInline title={sprintf(_("Could not connect to %s"), ssid)}>
    {<p>{_("Check the authentication parameters.")}</p>}
  </Alert>
);

// FIXME: improve error handling. The errors props should have a key/value error
//  and the component should show all of them, if any
export default function WifiConnectionForm({ network }: { network: WifiNetwork }) {
  const navigate = useNavigate();
  const settings = network.settings?.wireless || new Wireless();
  const [error, setError] = useState(false);
  const { mutateAsync: addConnection } = useAddConnectionMutation();
  const { mutateAsync: updateConnection } = useConnectionMutation();
  const [security, setSecurity] = useState<string>(
    settings?.security || securityFrom(network?.security || []),
  );
  const [password, setPassword] = useState<string>(settings.password);
  const [isConnecting, setIsConnecting] = useState<boolean>(false);

  const accept = async (e) => {
    e.preventDefault();
    setError(false);
    // FIXME: do not mutate the original object!
    const connection = network.settings || new Connection(network.ssid);
    connection.wireless = new Wireless({ ssid: network.ssid, security, password, hidden: false });
    const action = network.settings ? updateConnection : addConnection;
    action(connection).catch(() => setError(true));
  };

  useEffect(() => {
    if (network.device?.state === DeviceState.CONFIG) {
      setIsConnecting(true);
    }
  }, [network.device]);

  useEffect(() => {
    if (!isConnecting) return;

    if (!network.device) {
      setIsConnecting(false);
      setError(true);
    }
  }, [network.device, isConnecting, navigate]);

  return (
    /** TRANSLATORS: accessible name for the WiFi connection form */
    <Form onSubmit={accept} aria-label={_("WiFi connection form")}>
      {error && <ConnectionError ssid={network.ssid} />}

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
          {/* TRANSLATORS: button label, connect to a Wi-Fi network */}
          {_("Connect")}
        </Button>
        {/* TRANSLATORS: button label */}
        <Button variant="link" isDisabled={isConnecting} onClick={() => navigate(-1)}>
          {_("Cancel")}
        </Button>
      </ActionGroup>
    </Form>
  );
}
