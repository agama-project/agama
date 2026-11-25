/*
 * Copyright (c) [2026] SUSE LLC
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

import React from "react";
import {
  Alert,
  Content,
  FormGroup,
  FormSelect,
  FormSelectOption,
  TextInput,
} from "@patternfly/react-core";
import { isEmpty } from "radashi";
import { FormValidationError, PasswordInput } from "~/components/core";
import { IEEE8021X } from "~/types/network";
import { _ } from "~/i18n";

// EAP methods and their inner (phase 2) authentication methods, the first one being the default.
const eapOptions = {
  peap: {
    label: "PEAP",
    phase2Auth: [
      { value: "mschapv2", label: "MSCHAPv2" },
      { value: "gtc", label: "GTC" },
      { value: "md5", label: "MD5" },
    ],
  },
  ttls: {
    label: "TTLS",
    phase2Auth: [
      { value: "pap", label: "PAP" },
      { value: "mschapv2", label: "MSCHAPv2" },
      { value: "mschap", label: "MSCHAP" },
      { value: "chap", label: "CHAP" },
    ],
  },
};

type EapMethod = keyof typeof eapOptions;

/**
 * Settings to start with when connecting to a WPA Enterprise network.
 */
export const defaultEnterpriseSettings: IEEE8021X = {
  eap: ["peap"],
  phase2Auth: eapOptions.peap.phase2Auth[0].value,
};

const UnverifiedServerAlert = () => {
  return (
    <Alert isInline title={_("Server certificate will not be verified")} variant="warning">
      <Content component="p">
        {_("Make sure you trust this network before sending your credentials.")}
      </Content>
    </Alert>
  );
};

type WifiEnterpriseFieldsProps = {
  value: IEEE8021X;
  onChange: (value: IEEE8021X) => void;
  showErrors?: boolean;
};

/**
 * Fields for the 802.1X (WPA Enterprise) authentication of a Wi-Fi network
 */
export default function WifiEnterpriseFields({
  value,
  onChange,
  showErrors,
}: WifiEnterpriseFieldsProps) {
  const eap = (
    Object.hasOwn(eapOptions, value.eap[0]) ? value.eap[0] : defaultEnterpriseSettings.eap[0]
  ) as EapMethod;
  const update = (changes: Partial<IEEE8021X>) => onChange({ ...value, ...changes });
  const identityError = showErrors && isEmpty(value.identity);
  const passwordError = showErrors && isEmpty(value.password);

  return (
    <>
      {/* TRANSLATORS: EAP method used by a WPA Enterprise Wi-Fi network (e.g., PEAP) */}
      <FormGroup fieldId="eap" label={_("Authentication")}>
        <FormSelect
          id="eap"
          value={eap}
          onChange={(_, v) =>
            update({ eap: [v], phase2Auth: eapOptions[v as EapMethod].phase2Auth[0].value })
          }
        >
          {Object.entries(eapOptions).map(([value, { label }]) => (
            <FormSelectOption key={value} value={value} label={label} />
          ))}
        </FormSelect>
      </FormGroup>
      {/* TRANSLATORS: inner (phase 2) authentication method of a WPA Enterprise Wi-Fi network */}
      <FormGroup fieldId="phase2Auth" label={_("Inner authentication")}>
        <FormSelect
          id="phase2Auth"
          value={value.phase2Auth}
          onChange={(_, v) => update({ phase2Auth: v })}
        >
          {eapOptions[eap].phase2Auth.map(({ value, label }) => (
            <FormSelectOption key={value} value={value} label={label} />
          ))}
        </FormSelect>
      </FormGroup>
      <FormGroup fieldId="identity" label={_("User name")}>
        <TextInput
          id="identity"
          value={value.identity ?? ""}
          validated={identityError ? "error" : "default"}
          onChange={(_, v) => update({ identity: v || undefined })}
        />
        <FormValidationError message={identityError && _("User name is required.")} />
      </FormGroup>
      <FormGroup fieldId="password" label={_("Password")}>
        <PasswordInput
          id="password"
          name="password"
          value={value.password ?? ""}
          validated={passwordError ? "error" : "default"}
          onChange={(_, v) => update({ password: v || undefined })}
        />
        <FormValidationError message={passwordError && _("Password is required.")} />
      </FormGroup>
      {/* TRANSLATORS: outer identity sent before the secure tunnel is established */}
      <FormGroup fieldId="anonymousIdentity" label={_("Anonymous identity")}>
        <TextInput
          id="anonymousIdentity"
          value={value.anonymousIdentity ?? ""}
          onChange={(_, v) => update({ anonymousIdentity: v || undefined })}
        />
      </FormGroup>
      <UnverifiedServerAlert />
    </>
  );
}
