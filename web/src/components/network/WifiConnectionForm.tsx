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
import { Connection, ConnectionState, WifiNetwork, Wireless } from "~/types/network";
import { isEmpty } from "radashi";
import { sprintf } from "sprintf-js";
import { _ } from "~/i18n";
import { useConnections } from "~/hooks/network/system";
import { useConnectionMutation } from "~/hooks/network/config";

const securityOptions = [
  // TRANSLATORS: WiFi authentication mode
  { value: "none", label: _("None") },
  // TRANSLATORS: WiFi authentication mode
  { value: "wpa-psk", label: _("WPA & WPA2 Personal") },
];

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
  const connections = useConnections({ suspense: true });
  const connection = connections.find((c) => c.id === network.ssid);
  const settings = network.settings?.wireless || new Wireless();
  const [error, setError] = useState(false);
  const [security, setSecurity] = useState<string>(
    settings?.security || securityFrom(network?.security || []),
  );
  const [password, setPassword] = useState<string>(settings.password || "");
  const [isActivating, setIsActivating] = useState<boolean>(false);
  const [isConnecting, setIsConnecting] = useState<boolean>(
    connection?.state === ConnectionState.activating,
  );
  const { mutateAsync: updateConnection } = useConnectionMutation();

  useEffect(() => {
    if (!isActivating) return;

    if (connection.state === ConnectionState.deactivated) {
      setError(true);
      setIsConnecting(false);
      setIsActivating(false);
    }
  }, [isActivating, connection?.state]);

  useEffect(() => {
    if (isConnecting && connection?.state === ConnectionState.activating) {
      setIsActivating(true);
    }
  }, [isConnecting, connection]);

  const accept = async (e) => {
    e.preventDefault();
    // FIXME: do not mutate the original object!
    const nextConnection = network.settings || new Connection(network.ssid);
    nextConnection.wireless = new Wireless({
      ssid: network.ssid,
      security: security || "none",
      password,
      hidden: false,
    });
    updateConnection(nextConnection).catch(() => setError(true));
    setError(false);
    setIsConnecting(true);
  };

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
              {securityOptions.map((security) => (
                <FormSelectOption
                  key={security.value}
                  value={security.value}
                  label={security.label}
                />
              ))}
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
