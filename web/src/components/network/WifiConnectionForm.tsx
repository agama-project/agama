/*
 * Copyright (c) [2022-2026] SUSE LLC
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

import React, { useEffect, useReducer } from "react";
import { isEmpty } from "radashi";
import {
  ActionGroup,
  Alert,
  Content,
  Form,
  FormGroup,
  FormSelect,
  FormSelectOption,
} from "@patternfly/react-core";
import { Page, PasswordInput } from "~/components/core";
import { Connection, WifiNetwork, Wireless } from "~/types/network";
import { useWifiNetworks } from "~/hooks/model/system/network";
import { useConnectionMutation } from "~/hooks/model/config/network";
import WifiNetworksSelector from "./WifiNetworksSelector";
import { useNavigate } from "react-router";
import { PATHS } from "~/routes/network";
import { N_, _ } from "~/i18n";

const securityOptions = [
  // TRANSLATORS: WiFi authentication mode
  { value: "none", label: N_("None") },
  // TRANSLATORS: WiFi authentication mode
  { value: "wpa-psk", label: N_("WPA & WPA2 Personal") },
];

const securityFrom = (supported: string[]) => {
  if (supported.includes("WPA2")) return "wpa-psk";
  if (supported.includes("WPA1")) return "wpa-psk";
  return "none";
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

type FormState = {
  ssid: string;
  security: string;
  password: string;
};

type FormAction =
  | { type: "INITIALIZE"; networks: WifiNetwork[] }
  | { type: "SET_SSID"; ssid: string; networks: WifiNetwork[] }
  | { type: "SET_SECURITY"; security: string }
  | { type: "SET_PASSWORD"; password: string };

const formReducer = (state: FormState, action: FormAction): FormState => {
  switch (action.type) {
    case "INITIALIZE": {
      const network = action.networks[0];
      return network
        ? { ssid: network.ssid, security: securityFrom(network.security), password: "" }
        : state;
    }
    case "SET_SSID": {
      const network = action.networks.find((n) => n.ssid === action.ssid);
      return {
        ssid: action.ssid,
        security: network ? securityFrom(network.security) : "",
        password: "",
      };
    }
    case "SET_SECURITY":
      return { ...state, security: action.security };
    case "SET_PASSWORD":
      return { ...state, password: action.password };
  }
};

export default function WifiConnectionForm() {
  const navigate = useNavigate();
  const networks = useWifiNetworks();
  const [form, dispatch] = useReducer(formReducer, { ssid: "", security: "", password: "" });
  const { mutateAsync: updateConnection } = useConnectionMutation();

  useEffect(() => {
    if (!isEmpty(networks) && !form.ssid) {
      dispatch({ type: "INITIALIZE", networks });
    }
  }, [networks, form.ssid]);

  const network = networks.find((n) => n.ssid === form.ssid);
  const isPublicNetwork = isEmpty(network?.security);

  const accept = async (e) => {
    e.preventDefault();
    const nextConnection = new Connection(form.ssid, {
      wireless: new Wireless({
        ssid: form.ssid,
        security: form.security || "none",
        password: form.password,
        hidden: false,
      }),
    });
    updateConnection(nextConnection);
    navigate(PATHS.root);
  };

  return (
    <Page
      breadcrumbs={[
        { label: _("Network"), path: PATHS.root },
        { label: _("New Wi-Fi connection") },
      ]}
      progress={{ scope: "network", ensureRefetched: "system" }}
    >
      <Page.Content>
        {/** TRANSLATORS: accessible name for the WiFi connection form */}
        <Form id="wifiConnectionForm" onSubmit={accept} aria-label={_("Wi-Fi connection form")}>
          <FormGroup fieldId="ssid" label={_("Network")}>
            <WifiNetworksSelector
              id="ssid"
              value={form.ssid}
              onChange={(_, v) => dispatch({ type: "SET_SSID", ssid: v, networks })}
            />
          </FormGroup>

          {isPublicNetwork && <PublicNetworkAlert />}
          {/* TRANSLATORS: Wifi security configuration (password protected or not) */}
          {!isEmpty(network?.security) && (
            <FormGroup fieldId="security" label={_("Security")}>
              <FormSelect
                id="security"
                aria-label={_("Security")}
                value={form.security}
                onChange={(_, v) => dispatch({ type: "SET_SECURITY", security: v })}
              >
                {securityOptions.map((security) => (
                  <FormSelectOption
                    key={security.value}
                    value={security.value}
                    /* eslint-disable agama-i18n/string-literals */
                    label={_(security.label)}
                  />
                ))}
              </FormSelect>
            </FormGroup>
          )}
          {form.security === "wpa-psk" && (
            // TRANSLATORS: WiFi password
            <FormGroup fieldId="password" label={_("WPA Password")}>
              <PasswordInput
                id="password"
                name="password"
                aria-label={_("Password")}
                value={form.password}
                onChange={(_, v) => dispatch({ type: "SET_PASSWORD", password: v })}
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
      </Page.Content>
    </Page>
  );
}
