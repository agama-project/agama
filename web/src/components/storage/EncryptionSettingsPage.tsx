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

import React, { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { ActionGroup, Alert, Checkbox, Content, Form } from "@patternfly/react-core";
import { NestedContent, Page, PasswordAndConfirmationInput } from "~/components/core";
import PasswordCheck from "~/components/users/PasswordCheck";
import { useEncryptionMethods } from "~/hooks/storage/system";
import { useEncryption } from "~/queries/storage/config-model";
import { apiModel } from "~/api/storage";
import { isEmpty } from "radashi";
import { _ } from "~/i18n";

/**
 * Renders a form that allows the user change encryption settings
 */
export default function EncryptionSettingsPage() {
  const navigate = useNavigate();
  const { encryption: encryptionConfig, enable, disable } = useEncryption();
  const methods = useEncryptionMethods();

  const [errors, setErrors] = useState([]);
  const [isEnabled, setIsEnabled] = useState(false);
  const [password, setPassword] = useState("");
  const [method, setMethod] = useState<apiModel.EncryptionMethod>("luks2");

  const passwordRef = useRef<HTMLInputElement>();
  const formId = "encryptionSettingsForm";

  useEffect(() => {
    if (encryptionConfig) {
      setIsEnabled(true);
      setMethod(encryptionConfig.method);
      setPassword(encryptionConfig.password || "");
    }
  }, [encryptionConfig]);

  const changePassword = (_, v) => setPassword(v);

  const changeMethod = (_, useTPM) => {
    const method = useTPM ? "tpmFde" : "luks2";
    setMethod(method);
  };

  const onSubmit = (e) => {
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

    const commit = () => (isEnabled ? enable(method, password) : disable());

    commit();
    navigate("..");
  };

  // TRANSLATORS: "Trusted Platform Module" is the name of the technology and TPM its abbreviation
  const tpmLabel = _("Use the Trusted Platform Module (TPM) to decrypt automatically on each boot");
  // TRANSLATORS: The word 'directly' is key here. For example, booting to the installer media and then choosing
  // 'Boot from Hard Disk' from there will not work. Keep it sort (this is a hint in a form) but keep it clear.
  const tpmExplanation = _(
    "The password will not be needed to boot and access the data if the \
TPM can verify the integrity of the system. TPM sealing requires the new system to be booted \
directly on its first run.",
  );

  const isTpmAvailable = methods.includes("tpmFde");

  return (
    <Page>
      <Page.Header>
        <Content component="h2">{_("Encryption settings")}</Content>
      </Page.Header>

      <Page.Content>
        <Form id={formId} onSubmit={onSubmit}>
          {errors.length > 0 && (
            <Alert variant="warning" isInline title={_("Something went wrong")}>
              {errors.map((e, i) => (
                <p key={`error_${i}`}>{e}</p>
              ))}
            </Alert>
          )}
          <Checkbox
            id="encryption"
            label={_("Encrypt the system")}
            description={_(
              "Full Disk Encryption (FDE) allows to protect the information stored \
at the new file systems, including data, programs, and system files.",
            )}
            isChecked={isEnabled}
            onChange={() => setIsEnabled(!isEnabled)}
          />
          {isEnabled && (
            <NestedContent margin="mxLg">
              <PasswordAndConfirmationInput
                inputRef={passwordRef}
                initialValue={encryptionConfig?.password}
                value={password}
                onChange={changePassword}
                isDisabled={!isEnabled}
                showErrors={false}
              />
              <PasswordCheck password={password} />
              {isTpmAvailable && (
                <Checkbox
                  id="tpmEncryptionMethod"
                  label={tpmLabel}
                  description={tpmExplanation}
                  isChecked={method === "tpmFde"}
                  onChange={changeMethod}
                />
              )}
            </NestedContent>
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
