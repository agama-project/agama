/*
 * Copyright (c) [2024] SUSE LLC
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

// @ts-check

import React, { useEffect, useState } from "react";
import { Checkbox, Form } from "@patternfly/react-core";
import { _ } from "~/i18n";
import { If, SwitchField, PasswordAndConfirmationInput, Popup } from "~/components/core";
import { EncryptionMethods } from "~/client/storage";

/**
 * @typedef {object} EncryptionSetting
 * @property {string} password
 * @property {string} [method]
 */

const DIALOG_TITLE = _("Encryption");
const DIALOG_DESCRIPTION = _("Full Disk Encryption (FDE) allows to protect the information stored \
at the device, including data, programs, and system files.");
// TRANSLATORS: "Trusted Platform Module" is the name of the technology and TPM its abbreviation
const TPM_LABEL = _("Use the Trusted Platform Module (TPM) to decrypt automatically on each boot");
// TRANSLATORS: The word 'directly' is key here. For example, booting to the installer media and then choosing
// 'Boot from Hard Disk' from there will not work. Keep it sort (this is a hint in a form) but keep it clear.
const TPM_EXPLANATION = _("The password will not be needed to boot and access the data if the \
TPM can verify the integrity of the system. TPM sealing requires the new system to be booted \
directly on its first run.");

/**
 * Renders a dialog that allows the user change encryption settings
 * @component
 *
 * @typedef {object} EncryptionSettingsDialogProps
 * @property {string} password - Password for encryption.
 * @property {string} method - Encryption method.
 * @property {string[]} methods - Possible encryption methods.
 * @property {boolean} [isOpen=false] - Whether the dialog is visible or not.
 * @property {() => void} onCancel - Callback to trigger when on cancel action.
 * @property {(settings: EncryptionSetting) => void} onAccept - Callback to trigger on accept action.
 *
 * @param {EncryptionSettingsDialogProps} props
 */
export default function EncryptionSettingsDialog({
  password: passwordProp,
  method: methodProp,
  methods,
  isOpen = false,
  onCancel,
  onAccept
}) {
  const [isEnabled, setIsEnabled] = useState(passwordProp?.length > 0);
  const [password, setPassword] = useState(passwordProp);
  const [method, setMethod] = useState(methodProp);
  const [passwordsMatch, setPasswordsMatch] = useState(true);
  const [validSettings, setValidSettings] = useState(true);
  const formId = "encryptionSettingsForm";

  useEffect(() => {
    setValidSettings(!isEnabled || (password.length > 0 && passwordsMatch));
  }, [isEnabled, password, passwordsMatch]);

  const changePassword = (_, v) => setPassword(v);
  const changeMethod = (_, useTPM) => setMethod(useTPM ? EncryptionMethods.TPM : EncryptionMethods.LUKS2);

  const submitSettings = (e) => {
    e.preventDefault();

    if (isEnabled) {
      onAccept({ password, method });
    } else {
      onAccept({ password: "" });
    }
  };

  return (
    <Popup title={DIALOG_TITLE} description={DIALOG_DESCRIPTION} isOpen={isOpen}>
      <SwitchField
        highlightContent
        isChecked={isEnabled}
        onClick={() => setIsEnabled(!isEnabled)}
        label={_("Encrypt the system")}
        textWrapper="span"
      >
        <Form id={formId} onSubmit={submitSettings}>
          <PasswordAndConfirmationInput
            value={password}
            onChange={changePassword}
            onValidation={setPasswordsMatch}
            isDisabled={!isEnabled}
          />
          <If
            condition={methods.includes(EncryptionMethods.TPM)}
            then={
              <Checkbox
                id="tpm_encryption_method"
                label={TPM_LABEL}
                description={TPM_EXPLANATION}
                isChecked={method === EncryptionMethods.TPM}
                isDisabled={!isEnabled}
                onChange={changeMethod}
              />
            }
          />
        </Form>
      </SwitchField>
      <Popup.Actions>
        <Popup.Confirm form={formId} type="submit" isDisabled={!validSettings}>
          {_("Accept")}
        </Popup.Confirm>
        <Popup.Cancel onClick={onCancel} />
      </Popup.Actions>
    </Popup>
  );
}
