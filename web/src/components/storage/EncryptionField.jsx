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
import { Checkbox, Form, Skeleton } from "@patternfly/react-core";
import { _ } from "~/i18n";
import { noop } from "~/utils";
import { If, SwitchField, SettingsField, PasswordAndConfirmationInput, Popup } from "~/components/core";
import { EncryptionMethods } from "~/client/storage";

/**
 * @typedef {import ("~/client/storage").StorageDevice} StorageDevice
 */

const LABEL = _("Encryption");
const DESCRIPTION = _("Full disk encryption allows to protect the information stored at \
the device, including data, programs, and system files.");

/**
 * Form for configuring the encryption password.
 * @component
 *
 * @todo: improve typechecking for method and methods
 *
 * @param {object} props
 * @param {string} props.id - Form ID.
 * @param {boolean} props.isDisabled=false - Whether the form is disabled or not.
 * @param {string} props.password - Password for encryption.
 * @param {string} props.method - Encryption method.
 * @param {string[]} props.methods - Possible encryption methods.
 * @param {(password: string, method: string) => void} [props.onSubmit=noop] - On submit callback.
 * @param {(valid: boolean) => void} [props.onValidate=noop] - On validate callback.
 */
const EncryptionSettingsForm = ({
  id,
  isDisabled = false,
  password: passwordProp,
  method: methodProp,
  methods,
  onSubmit = noop,
  onValidate = noop
}) => {
  const [password, setPassword] = useState(passwordProp || "");
  const [method, setMethod] = useState(methodProp);

  useEffect(() => {
    if (isDisabled) {
      onValidate(true);
      setPassword("");
      return;
    }

    if (password.length === 0) onValidate(false);
  }, [isDisabled, password, onValidate]);

  const changePassword = (_, v) => setPassword(v);

  const changeMethod = (_, value) => {
    const newMethod = value ? EncryptionMethods.TPM : EncryptionMethods.LUKS2;
    setMethod(newMethod);
  };

  const submitForm = (e) => {
    e.preventDefault();
    onSubmit(password, method);
  };

  const Description = () => (
    <span
      dangerouslySetInnerHTML={{
        // TRANSLATORS: The word 'directly' is key here. For example, booting to the installer media and then choosing
        // 'Boot from Hard Disk' from there will not work. Keep it sort (this is a hint in a form) but keep it clear.
        // Do not translate 'abbr' and 'title', they are part of the HTML markup.
        __html: _("The password will not be needed to boot and access the data if the <abbr title='Trusted Platform Module'>TPM</abbr> can verify the integrity of the system. TPM sealing requires the new system to be booted directly on its first run.")
      }}
    />
  );

  return (
    <Form id={id} onSubmit={submitForm}>
      <PasswordAndConfirmationInput
        value={password}
        onChange={changePassword}
        onValidation={onValidate}
        isDisabled={isDisabled}
      />
      <If
        condition={methods.includes(EncryptionMethods.TPM)}
        then={
          <Checkbox
            id="encryption_method"
            label={_("Use the TPM to decrypt automatically on each boot")}
            description={<Description />}
            isChecked={method === EncryptionMethods.TPM}
            isDisabled={isDisabled}
            onChange={changeMethod}
          />
        }
      />
    </Form>
  );
};

/**
 * Allows to define encryption
 * @component
 *
 * @typedef {object} EncryptionConfig
 * @property {string} password
 * @property {string} [method]
 *
 * @typedef {object} EncryptionFieldProps
 * @property {string} [password=""] - Password for encryption
 * @property {string} [method=""] - Encryption method
 * @property {string[]} [methods=[]] - Possible encryption methods
 * @property {boolean} [isLoading=false] - Whether to show the selector as loading
 * @property {(config: EncryptionConfig) => void} [onChange=noop] - On change callback
 *
 * @param {EncryptionFieldProps} props
 */
export default function EncryptionField({
  password = "",
  method = "",
  // FIXME: should be available methods actually a prop?
  methods = [],
  isLoading = false,
  onChange = noop
}) {
  const [isActive, setIsActive] = useState(password !== "");
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isFormValid, setIsFormValid] = useState(true);

  const openForm = () => setIsFormOpen(true);

  const closeForm = () => setIsFormOpen(false);

  const acceptForm = (newPassword, newMethod) => {
    closeForm();

    if (isActive) {
      onChange({ password: newPassword, method: newMethod });
    } else {
      onChange({ password: "" });
    }
  };

  const validateForm = (valid) => setIsFormValid(valid);

  if (isLoading) return <Skeleton width="25%" />;

  // FIXME: extract to the top to avoid redefinitions?
  const FieldValue = () => {
    if (isLoading) return <Skeleton width="25%" />;

    if (!password || password === "") return _("disabled");
    if (method === EncryptionMethods.LUKS2) return _("enabled");
    if (method === EncryptionMethods.TPM) return _("using TPM unlocking");
  };

  return (
    <SettingsField
      label={LABEL}
      description={DESCRIPTION}
      value={<FieldValue />}
      onClick={openForm}
    >
      <Popup title={_("Encryption")} description={DESCRIPTION} isOpen={isFormOpen}>
        <div className="stack">
          <SwitchField
            highlightContent
            isChecked={isActive}
            onClick={() => setIsActive(!isActive)}
            label={_("Encrypt the system")}
            textWrapper="span"
          >
            <EncryptionSettingsForm
              id="encryptionSettingsForm"
              isDisabled={!isActive}
              password={password}
              method={method}
              methods={methods}
              onSubmit={acceptForm}
              onValidate={validateForm}
            />
          </SwitchField>
        </div>
        <Popup.Actions>
          <Popup.Confirm form="encryptionSettingsForm" type="submit" isDisabled={!isFormValid}>{_("Accept")}</Popup.Confirm>
          <Popup.Cancel onClick={closeForm} />
        </Popup.Actions>
      </Popup>
    </SettingsField>
  );
}
