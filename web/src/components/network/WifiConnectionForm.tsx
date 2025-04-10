/*
 * Copyright (c) [2022-2025] SUSE LLC
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
  Content,
  Form,
  FormGroup,
  FormSelect,
  FormSelectOption,
  Spinner,
} from "@patternfly/react-core";
import { Page, PasswordInput } from "~/components/core";
import { useAddConnectionMutation, useConnectionMutation } from "~/queries/network";
import { Connection, Device, DeviceState, WifiNetwork, Wireless } from "~/types/network";
import { _ } from "~/i18n";
import { sprintf } from "sprintf-js";
import { isEmpty } from "~/utils";

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

const PublicNetworkAlert = () => {
  return (
    <Alert title={_("Not protected network")} variant="warning">
      <Content component="p">
        {_("You will connect to a public network without encryption. Your data may not be secure.")}
      </Content>
    </Alert>
  );
};

const ConnectingAlert = () => {
  return (
    <Alert
      isPlain
      customIcon={<Spinner size="md" aria-hidden />}
      title={_("Setting up connection")}
    >
      <Content component="p">{_("It may take some time.")}</Content>
      <Content component="p">
        {_("Details will appear after the connection is successfully established.")}
      </Content>
    </Alert>
  );
};

const ConnectionError = ({ ssid, isPublicNetwork }) => {
  // TRANSLATORS: %s will be replaced by network ssid.
  const title = sprintf(_("Could not connect to %s"), ssid);
  return (
    <Alert variant="warning" isInline title={title}>
      {!isPublicNetwork && (
        <Content component="p">{_("Check the authentication parameters.")}</Content>
      )}
    </Alert>
  );
};

// FIXME: improve error handling. The errors props should have a key/value error
//  and the component should show all of them, if any
export default function WifiConnectionForm({ network }: { network: WifiNetwork }) {
  const settings = network.settings?.wireless || new Wireless();
  const [error, setError] = useState(false);
  const [device, setDevice] = useState<Device>();
  const [security, setSecurity] = useState<string>(
    settings?.security || securityFrom(network?.security || []),
  );
  const [password, setPassword] = useState<string>(settings.password || "");
  const [isConnecting, setIsConnecting] = useState<boolean>(false);
  const { mutateAsync: addConnection } = useAddConnectionMutation();
  const { mutateAsync: updateConnection } = useConnectionMutation();

  const accept = async (e) => {
    e.preventDefault();
    setError(false);
    setIsConnecting(true);
    setDevice(network.device);
    // FIXME: do not mutate the original object!
    const connection = network.settings || new Connection(network.ssid);
    connection.wireless = new Wireless({ ssid: network.ssid, security, password, hidden: false });
    const action = network.settings ? updateConnection : addConnection;
    action(connection).catch(() => setError(true));
  };

  useEffect(() => {
    setDevice(network.device);
  }, [network.device]);

  useEffect(() => {
    if (!device) return;

    if (device?.state === DeviceState.CONNECTING) {
      setError(false);
      setIsConnecting(true);
    }

    if (isConnecting && device && device.state === DeviceState.FAILED) {
      setError(true);
      setIsConnecting(false);
    }
  }, [isConnecting, device]);

  const isPublicNetwork = isEmpty(network.security);

  if (isConnecting) return <ConnectingAlert />;

  return (
    <>
      {isPublicNetwork && <PublicNetworkAlert />}
      {/** TRANSLATORS: accessible name for the WiFi connection form */}
      <Form id="wifiConnectionForm" onSubmit={accept} aria-label={_("Wi-Fi connection form")}>
        {error && <ConnectionError ssid={network.ssid} isPublicNetwork={isPublicNetwork} />}

        {/* TRANSLATORS: Wifi security configuration (password protected or not) */}
        {!isEmpty(network.security) && (
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
        )}
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
          <Page.Submit form="wifiConnectionForm">
            {/* TRANSLATORS: button label, connect to a Wi-Fi network */}
            {_("Connect")}
          </Page.Submit>
          <Page.Back>{_("Cancel")}</Page.Back>
        </ActionGroup>
      </Form>
    </>
  );
}
