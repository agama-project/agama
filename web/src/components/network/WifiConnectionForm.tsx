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

import React, { useEffect, useId, useReducer, useRef } from "react";
import { isEmpty } from "radashi";
import {
  ActionGroup,
  Alert,
  Content,
  EmptyState,
  Form,
  FormGroup,
  FormSelect,
  FormSelectOption,
  HelperText,
  HelperTextItem,
} from "@patternfly/react-core";
import Icon from "~/components/layout/Icon";
import { PasswordInput } from "~/components/core";
import Page from "~/components/layout/Page";
import FieldNestedContent from "~/components/form/FieldNestedContent";
import { Connection, IEEE8021X, WifiNetwork, Wireless, WirelessSecurity } from "~/types/network";
import { useWifiNetworks } from "~/hooks/model/system/network";
import { useConnectionMutation } from "~/hooks/model/config/network";
import WifiNetworksSelector from "./WifiNetworksSelector";
import WifiEnterpriseFields, { defaultEnterpriseSettings } from "./WifiEnterpriseFields";
import { useNavigate } from "react-router";
import { PATHS } from "~/routes/network";
import { _ } from "~/i18n";
import { wifiSecurityLabel } from "~/utils/network";
import { SYSTEM_QUERY_KEY } from "~/hooks/model/system";
import { useAnnounce } from "~/context/announcer";

const securityOptions: WirelessSecurity[] = ["none", "wpa-psk", "wpa-eap"];

const securityFrom = (supported: string[]): WirelessSecurity => {
  if (supported.includes("802.1X") && !supported.includes("PSK")) return "wpa-eap";
  if (supported.includes("WPA2")) return "wpa-psk";
  if (supported.includes("WPA1")) return "wpa-psk";
  return "none";
};

const PublicNetworkAlert = () => {
  return (
    <Alert isInline title={_("Not protected network")} variant="warning">
      <Content component="p">
        {_("You will connect to a public network without encryption. Your data may not be secure.")}
      </Content>
    </Alert>
  );
};

type FormState = {
  ssid: string;
  security: WirelessSecurity | "";
  password: string;
  ieee8021x: IEEE8021X;
  showErrors: boolean;
};

const initialState: FormState = {
  ssid: "",
  security: "",
  password: "",
  ieee8021x: defaultEnterpriseSettings,
  showErrors: false,
};

type FormAction =
  | { type: "INITIALIZE"; networks: WifiNetwork[] }
  | { type: "SET_SSID"; ssid: string; networks: WifiNetwork[] }
  | { type: "SET_SECURITY"; security: WirelessSecurity }
  | { type: "SET_PASSWORD"; password: string }
  | { type: "SET_IEEE8021X"; ieee8021x: IEEE8021X }
  | { type: "SHOW_ERRORS" };

const formReducer = (state: FormState, action: FormAction): FormState => {
  switch (action.type) {
    case "INITIALIZE": {
      const network = action.networks[0];
      return network
        ? { ...initialState, ssid: network.ssid, security: securityFrom(network.security) }
        : state;
    }
    case "SET_SSID": {
      const network = action.networks.find((n) => n.ssid === action.ssid);
      return {
        ...initialState,
        ssid: action.ssid,
        security: network ? securityFrom(network.security) : "",
      };
    }
    case "SET_SECURITY":
      return { ...state, security: action.security };
    case "SET_PASSWORD":
      return { ...state, password: action.password };
    case "SET_IEEE8021X":
      return { ...state, ieee8021x: action.ieee8021x };
    case "SHOW_ERRORS":
      return { ...state, showErrors: true };
  }
};

function WifiConnectionFormContent() {
  const navigate = useNavigate();
  const networks = useWifiNetworks();
  const [form, dispatch] = useReducer(formReducer, initialState);
  const { mutateAsync: updateConnection } = useConnectionMutation();
  const announce = useAnnounce();
  const securityHintId = useId();
  const switchedToEnterprise = useRef(false);

  useEffect(() => {
    if (!isEmpty(networks) && !form.ssid) {
      dispatch({ type: "INITIALIZE", networks });
    }
  }, [networks, form.ssid]);

  const network = networks.find((n) => n.ssid === form.ssid);
  const isPublicNetwork = isEmpty(network?.security);
  const isEnterprise = form.security === "wpa-eap";
  // TRANSLATORS: hint shown below the Wi-Fi security selector when WPA Enterprise is selected
  const unverifiedNetworkHint = _(
    "The identity of the network cannot be verified. Connect only if you trust it.",
  );

  const accept = async (e) => {
    e.preventDefault();

    if (isEnterprise && [form.ieee8021x.identity, form.ieee8021x.password].some(isEmpty)) {
      dispatch({ type: "SHOW_ERRORS" });
      return;
    }

    const nextConnection = new Connection(form.ssid, {
      wireless: new Wireless({
        ssid: form.ssid,
        security: form.security || "none",
        password: isEnterprise ? undefined : form.password,
        hidden: false,
      }),
      ieee8021x: isEnterprise ? form.ieee8021x : undefined,
    });
    updateConnection(nextConnection);
    navigate(PATHS.root);
  };

  if (networks.length === 0)
    return (
      <EmptyState
        headingLevel="h2"
        titleText={_("No Wi-Fi networks were found")}
        icon={() => <Icon name="error" />}
      />
    );

  return (
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
            aria-describedby={isEnterprise ? securityHintId : undefined}
            onChange={(_, v) => {
              switchedToEnterprise.current = v === "wpa-eap";
              dispatch({ type: "SET_SECURITY", security: v as WirelessSecurity });
            }}
            onBlur={() => {
              // A description added while focused is usually not read, so it is announced instead
              if (switchedToEnterprise.current) announce(unverifiedNetworkHint);
              switchedToEnterprise.current = false;
            }}
          >
            {securityOptions.map((security) => (
              <FormSelectOption
                key={security}
                value={security}
                label={wifiSecurityLabel(security)}
              />
            ))}
          </FormSelect>
          {isEnterprise && (
            <FieldNestedContent>
              <HelperText id={securityHintId}>
                <HelperTextItem variant="warning">{unverifiedNetworkHint}</HelperTextItem>
              </HelperText>
            </FieldNestedContent>
          )}
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
      {isEnterprise && (
        <WifiEnterpriseFields
          value={form.ieee8021x}
          showErrors={form.showErrors}
          onChange={(v) => dispatch({ type: "SET_IEEE8021X", ieee8021x: v })}
        />
      )}
      <ActionGroup>
        <Page.Submit form="wifiConnectionForm">
          {/* TRANSLATORS: button label, connect to a Wi-Fi network */}
          {_("Connect")}
        </Page.Submit>
        <Page.Back>{_("Cancel")}</Page.Back>
      </ActionGroup>
    </Form>
  );
}

export default function wifiConnectionForm() {
  return (
    <Page
      breadcrumbs={[
        { label: _("Network"), path: PATHS.root },
        { label: _("New Wi-Fi connection") },
      ]}
      progress={{ scope: "network", awaitQueriesRefetch: [SYSTEM_QUERY_KEY] }}
    >
      <Page.Content>
        <WifiConnectionFormContent />
      </Page.Content>
    </Page>
  );
}
