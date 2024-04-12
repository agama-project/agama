/*
 * Copyright (c) [2022-2024] SUSE LLC
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
import { Checkbox, Form, Skeleton, Switch, Tooltip } from "@patternfly/react-core";

import { _ } from "~/i18n";
import SpacePolicyField from "~/components/storage/SpacePolicyField";
import PartitionsField from "~/components/storage/PartitionsField";
import { If, PasswordAndConfirmationInput, Section, Popup } from "~/components/core";
import { Icon } from "~/components/layout";
import { noop } from "~/utils";
import { SPACE_POLICIES } from "~/components/storage/utils";

/**
 * @typedef {import ("~/client/storage").ProposalSettings} ProposalSettings
 * @typedef {import ("~/client/storage").SpaceAction} SpaceAction
 * @typedef {import ("~/components/storage/utils").SpacePolicy} SpacePolicy
 * @typedef {import ("~/client/storage").StorageDevice} StorageDevice
 * @typedef {import ("~/client/storage").Volume} Volume
 */

/**
 * Form for configuring the encryption password.
 * @component
 *
 * @param {object} props
 * @param {string} props.id - Form ID.
 * @param {string} props.password - Password for encryption.
 * @param {string} props.method - Encryption method.
 * @param {string[]} props.methods - Possible encryption methods.
 * @param {(password: string, method: string) => void} [props.onSubmit=noop] - On submit callback.
 * @param {(valid: boolean) => void} [props.onValidate=noop] - On validate callback.
 */
const EncryptionSettingsForm = ({
  id,
  password: passwordProp,
  method: methodProp,
  methods,
  onSubmit = noop,
  onValidate = noop
}) => {
  const [password, setPassword] = useState(passwordProp || "");
  const [method, setMethod] = useState(methodProp);
  const tpmId = "tpm_fde";
  const luks2Id = "luks2";

  useEffect(() => {
    if (password.length === 0) onValidate(false);
  }, [password, onValidate]);

  const changePassword = (_, v) => setPassword(v);

  const changeMethod = (_, value) => {
    value ? setMethod(tpmId) : setMethod(luks2Id);
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
      />
      <If
        condition={methods.includes(tpmId)}
        then={
          <Checkbox
            id="encryption_method"
            label={_("Use the TPM to decrypt automatically on each boot")}
            description={<Description />}
            isChecked={method === tpmId}
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
 * @param {object} props
 * @param {string} [props.password=""] - Password for encryption
 * @param {string} [props.method=""] - Encryption method
 * @param {string[]} [props.methods] - Possible encryption methods
 * @param {boolean} [props.isChecked=false] - Whether encryption is selected
 * @param {boolean} [props.isLoading=false] - Whether to show the selector as loading
 * @param {(config: EncryptionConfig) => void} [props.onChange=noop] - On change callback
 *
 * @typedef {object} EncryptionConfig
 * @property {string} password
 * @property {string} [method]
 */
const EncryptionField = ({
  password = "",
  method = "",
  methods,
  isChecked: defaultIsChecked = false,
  isLoading = false,
  onChange = noop
}) => {
  const [isChecked, setIsChecked] = useState(defaultIsChecked);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isFormValid, setIsFormValid] = useState(true);

  const openForm = () => setIsFormOpen(true);

  const closeForm = () => setIsFormOpen(false);

  const acceptForm = (newPassword, newMethod) => {
    closeForm();
    onChange({ password: newPassword, method: newMethod });
  };

  const cancelForm = () => {
    setIsChecked(defaultIsChecked);
    closeForm();
  };

  const validateForm = (valid) => setIsFormValid(valid);

  const changeSelected = (_, value) => {
    setIsChecked(value);

    if (value && password.length === 0) openForm();

    if (!value) {
      onChange({ password: "" });
    }
  };

  const ChangeSettingsButton = () => {
    return (
      <Tooltip
        content={_("Change encryption settings")}
        entryDelay={400}
        exitDelay={50}
        position="right"
      >
        <button aria-label={_("Encryption settings")} className="plain-control" onClick={openForm}>
          <Icon name="tune" size="s" />
        </button>
      </Tooltip>
    );
  };

  if (isLoading) return <Skeleton width="25%" />;

  return (
    <>
      <div className="split">
        <Switch
          id="encryption"
          label={_("Use encryption")}
          isReversed
          isChecked={isChecked}
          onChange={changeSelected}
        />
        {isChecked && <ChangeSettingsButton />}
      </div>
      <Popup aria-label={_("Encryption settings")} title={_("Encryption settings")} isOpen={isFormOpen}>
        <EncryptionSettingsForm
          id="encryptionSettingsForm"
          password={password}
          method={method}
          methods={methods}
          onSubmit={acceptForm}
          onValidate={validateForm}
        />
        <Popup.Actions>
          <Popup.Confirm form="encryptionSettingsForm" type="submit" isDisabled={!isFormValid}>{_("Accept")}</Popup.Confirm>
          <Popup.Cancel onClick={cancelForm} />
        </Popup.Actions>
      </Popup>
    </>
  );
};

/**
 * Section for editing the proposal settings
 * @component
 *
 * @typedef {object} ProposalSettingsSectionProps
 * @property {ProposalSettings} settings
 * @property {StorageDevice[]} availableDevices
 * @property {String[]} encryptionMethods
 * @property {Volume[]} volumeTemplates
 * @property {boolean} [isLoading=false]
 * @property {(settings: object) => void} onChange
 *
 * @param {ProposalSettingsSectionProps} props
 */
export default function ProposalSettingsSection({
  settings,
  availableDevices,
  encryptionMethods,
  volumeTemplates,
  isLoading = false,
  onChange
}) {
  const changeEncryption = ({ password, method }) => {
    onChange({ encryptionPassword: password, encryptionMethod: method });
  };

  const changeVolumes = (volumes) => {
    onChange({ volumes });
  };

  const changeSpacePolicy = ({ spacePolicy, spaceActions }) => {
    onChange({
      spacePolicy: spacePolicy.id,
      spaceActions
    });
  };

  const changeBoot = ({ configureBoot, bootDevice }) => {
    onChange({
      configureBoot,
      bootDevice: bootDevice?.name
    });
  };

  const targetDevice = availableDevices.find(d => d.name === settings.targetDevice);
  const useEncryption = settings.encryptionPassword !== undefined && settings.encryptionPassword.length > 0;
  const { volumes = [], installationDevices = [], spaceActions = [] } = settings;
  const bootDevice = availableDevices.find(d => d.name === settings.bootDevice);
  const defaultBootDevice = availableDevices.find(d => d.name === settings.defaultBootDevice);
  const spacePolicy = SPACE_POLICIES.find(p => p.id === settings.spacePolicy);

  // Templates for already existing mount points are filtered out
  const usefulTemplates = () => {
    const mountPaths = volumes.map(v => v.mountPath);
    return volumeTemplates.filter(t => (
      t.mountPath.length > 0 && !mountPaths.includes(t.mountPath)
    ));
  };

  return (
    <>
      <Section title={_("Settings")}>
        <EncryptionField
          password={settings.encryptionPassword || ""}
          method={settings.encryptionMethod}
          methods={encryptionMethods}
          isChecked={useEncryption}
          isLoading={settings.encryptionPassword === undefined}
          onChange={changeEncryption}
        />
        <PartitionsField
          volumes={volumes}
          templates={usefulTemplates()}
          devices={availableDevices}
          target={settings.target}
          targetDevice={targetDevice}
          configureBoot={settings.configureBoot}
          bootDevice={bootDevice}
          defaultBootDevice={defaultBootDevice}
          isLoading={isLoading || settings.volumes === undefined}
          onVolumesChange={changeVolumes}
          onBootChange={changeBoot}
        />
        <SpacePolicyField
          policy={spacePolicy}
          actions={spaceActions}
          devices={installationDevices}
          isLoading={isLoading}
          onChange={changeSpacePolicy}
        />
      </Section>
    </>
  );
}
