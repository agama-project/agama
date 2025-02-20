/*
 * Copyright (c) [2024-2025] SUSE LLC
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

import React, { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { ActionGroup, Alert, Checkbox, Content, Form, Stack, Switch } from "@patternfly/react-core";
import { Page, PasswordAndConfirmationInput } from "~/components/core";
import { EncryptionMethods } from "~/types/storage";
import sizingStyles from "@patternfly/react-styles/css/utilities/Sizing/sizing";
import { isEmpty } from "~/utils";
import { _ } from "~/i18n";

// FIXME: temporary "mocks", please remove them after importing real code.
type Methods = (typeof EncryptionMethods)[keyof typeof EncryptionMethods];

type EncryptionHook = {
  mode: string;
  password: string;
  method: Methods;
  methods: Methods[];
};

const useEncryption = (): EncryptionHook => ({
  mode: "disabled",
  password: "s3cr3t",
  method: EncryptionMethods.LUKS2,
  methods: Object.values(EncryptionMethods),
});
const useEncryptionMutation = () => {
  console.info("Do not forget to replace this hook mock with real code.");

  return { mutate: async (args) => console.log("Performing a mutation with", args) };
};
// FIXME: read above ^^^

/**
 * Renders a form that allows the user change encryption settings
 */
export default function EncryptionSettingsDialog() {
  const navigate = useNavigate();
  const encryption = useEncryption();
  const { mutate: updateEncryption } = useEncryptionMutation();
  const [errors, setErrors] = useState([]);
  const [isEnabled, setIsEnabled] = useState(encryption.password.length > 0);
  const [password, setPassword] = useState(encryption.password);
  const [method, setMethod] = useState(encryption.method);
  const passwordRef = useRef<HTMLInputElement>();
  const formId = "encryptionSettingsForm";

  const onPasswordChange = (_, v) => setPassword(v);
  const changeMethod = (_, useTPM) =>
    setMethod(useTPM ? EncryptionMethods.TPM : EncryptionMethods.LUKS2);

  const submitSettings = (e) => {
    e.preventDefault();

    const nextErrors = [];
    setErrors([]);

    const passwordInput = passwordRef.current;

    if (isEnabled) {
      isEmpty(password) && nextErrors.push(_("Password is empty."));
      !passwordInput?.validity.valid && nextErrors.push(passwordInput?.validationMessage);
    }

    if (nextErrors.length > 0) {
      setErrors(nextErrors);
      return;
    }

    // FIXME: improve once the real hook is imported.
    const data = isEnabled ? { password, method } : { password: "" };

    updateEncryption(data)
      .then(() => navigate(".."))
      .catch((e) => setErrors([e.response.data]));
  };

  // TRANSLATORS: "Trusted Platform Module" is the name of the technology and TPM its abbreviation
  const tpm_label = _(
    "Use the Trusted Platform Module (TPM) to decrypt automatically on each boot",
  );
  // TRANSLATORS: The word 'directly' is key here. For example, booting to the installer media and then choosing
  // 'Boot from Hard Disk' from there will not work. Keep it sort (this is a hint in a form) but keep it clear.
  const tpm_explanation = _(
    "The password will not be needed to boot and access the data if the \
TPM can verify the integrity of the system. TPM sealing requires the new system to be booted \
directly on its first run.",
  );

  const tpmAvailable = encryption.methods.includes(EncryptionMethods.TPM);

  return (
    <Page>
      <Page.Header>
        <Content component="h2">{_("Encryption settings")}</Content>
        <Content component="small">
          {_(
            "Full Disk Encryption (FDE) allows to protect the information stored \
at the device, including data, programs, and system files.",
          )}
        </Content>
      </Page.Header>

      <Page.Content>
        <Form id={formId} onSubmit={submitSettings} isWidthLimited maxWidth="fit-content">
          {errors.length > 0 && (
            <Alert variant="warning" isInline title={_("Something went wrong")}>
              {errors.map((e, i) => (
                <p key={`error_${i}`}>{e}</p>
              ))}
            </Alert>
          )}
          <Switch
            label={_("Encrypt the system")}
            isChecked={isEnabled}
            onChange={() => setIsEnabled(!isEnabled)}
          />
          <Stack className={sizingStyles.w_50OnLg} hasGutter>
            <PasswordAndConfirmationInput
              inputRef={passwordRef}
              value={password}
              onChange={onPasswordChange}
              isDisabled={!isEnabled}
              showErrors={false}
            />
          </Stack>
          {tpmAvailable && (
            <Checkbox
              className={sizingStyles.w_50OnLg}
              id="tpm_encryption_method"
              label={tpm_label}
              description={tpm_explanation}
              isChecked={method === EncryptionMethods.TPM}
              isDisabled={!isEnabled}
              onChange={changeMethod}
            />
          )}
          <ActionGroup>
            <Page.Submit form={formId} />
            <Page.Cancel />
          </ActionGroup>
        </Form>
      </Page.Content>
    </Page>
  );
}
