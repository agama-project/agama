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

import React, { useEffect, useState } from "react";
import {
  Form, Skeleton, Switch, Checkbox,
  ToggleGroup, ToggleGroupItem,
  Tooltip
} from "@patternfly/react-core";

import { _ } from "~/i18n";
import { If, PasswordAndConfirmationInput, Section, Popup } from "~/components/core";
import { DeviceList, DeviceSelector, ProposalVolumes } from "~/components/storage";
import { Icon } from "~/components/layout";
import { noop } from "~/utils";

/**
 * @typedef {import ("~/client/storage").ProposalManager.ProposalSettings} ProposalSettings
 * @typedef {import ("~/client/storage").DevicesManager.StorageDevice} StorageDevice
 * @typedef {import ("~/client/storage").ProposalManager.Volume} Volume
 */

/**
 * Form for configuring the system volume group.
 * @component
 *
 * @param {object} props
 * @param {string} props.id - Form ID.
 * @param {ProposalSettings} props.settings - Settings used for calculating a proposal.
 * @param {StorageDevice[]} [props.devices=[]] - Available storage devices.
 * @param {onSubmitFn} [props.onSubmit=noop] - On submit callback.
 * @param {onValidateFn} [props.onValidate=noop] - On validate callback.
 *
 * @callback onSubmitFn
 * @param {string[]} devices - Name of the selected devices.
 *
 * @callback onValidateFn
 * @param {boolean} valid
 */
const LVMSettingsForm = ({
  id,
  settings,
  devices = [],
  onSubmit: onSubmitProp = noop,
  onValidate = noop
}) => {
  const [vgDevices, setVgDevices] = useState(settings.systemVGDevices);
  const [isBootDeviceSelected, setIsBootDeviceSelected] = useState(settings.systemVGDevices.length === 0);
  const [editedDevices, setEditedDevices] = useState(false);

  const selectBootDevice = () => {
    setIsBootDeviceSelected(true);
    onValidate(true);
  };

  const selectCustomDevices = () => {
    setIsBootDeviceSelected(false);
    const { bootDevice } = settings;
    const customDevices = (vgDevices.length === 0 && !editedDevices) ? [bootDevice] : vgDevices;
    setVgDevices(customDevices);
    onValidate(customDevices.length > 0);
  };

  const onChangeDevices = (selection) => {
    const selectedDevices = devices.filter(d => selection.includes(d.sid)).map(d => d.name);
    setVgDevices(selectedDevices);
    setEditedDevices(true);
    onValidate(devices.length > 0);
  };

  const onSubmit = (e) => {
    e.preventDefault();
    const customDevices = isBootDeviceSelected ? [] : vgDevices;
    onSubmitProp(customDevices);
  };

  const BootDevice = () => {
    const bootDevice = devices.find(d => d.name === settings.bootDevice);

    // FIXME: In this case, should be a "readOnly" selector.
    return <DeviceList devices={[bootDevice]} />;
  };

  return (
    <Form id={id} onSubmit={onSubmit}>
      <div className="split">
        <span>{_("Devices for creating the volume group")}</span>
        <ToggleGroup isCompact>
          <ToggleGroupItem
            text={_("Installation device")}
            buttonId="bootDevice"
            isSelected={isBootDeviceSelected}
            onClick={selectBootDevice}
          />
          <ToggleGroupItem
            text={_("Custom devices")}
            buttonId="customDevices"
            isSelected={!isBootDeviceSelected}
            onClick={selectCustomDevices}
          />
        </ToggleGroup>
      </div>
      <If
        condition={isBootDeviceSelected}
        then={<BootDevice />}
        else={
          <DeviceSelector
            isMultiple
            selected={devices.filter(d => vgDevices?.includes(d.name))}
            devices={devices}
            onChange={onChangeDevices}
          />
        }
      />
    </Form>
  );
};

/**
 * Allows to select LVM and configure the system volume group.
 * @component
 *
 * @param {object} props
 * @param {ProposalSettings} props.settings - Settings used for calculating a proposal.
 * @param {StorageDevice[]} [props.devices=[]] - Available storage devices.
 * @param {boolean} [props.isChecked=false] - Whether LVM is selected.
 * @param {boolean} [props.isLoading=false] - Whether to show the selector as loading.
 * @param {onChangeFn} [props.onChange=noop] - On change callback.
 *
 * @callback onChangeFn
 * @param {boolean} lvm
 */
const LVMField = ({
  settings,
  devices = [],
  isChecked: isCheckedProp = false,
  isLoading = false,
  onChange: onChangeProp = noop
}) => {
  const [isChecked, setIsChecked] = useState(isCheckedProp);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isFormValid, setIsFormValid] = useState(true);

  const onChange = (_, value) => {
    setIsChecked(value);
    onChangeProp({ lvm: value, vgDevices: [] });
  };

  const openForm = () => setIsFormOpen(true);

  const closeForm = () => setIsFormOpen(false);

  const onValidateForm = (valid) => setIsFormValid(valid);

  const onSubmitForm = (vgDevices) => {
    closeForm();
    onChangeProp({ vgDevices });
  };

  const description = _("Configuration of the system volume group. All the file systems will be \
created in a logical volume of the system volume group.");

  const LVMSettingsButton = () => {
    return (
      <Tooltip
        content={_("Configure the LVM settings")}
        entryDelay={400}
        exitDelay={50}
        position="right"
      >
        <button aria-label={_("LVM settings")} className="plain-control" onClick={openForm}>
          <Icon name="tune" size="s" />
        </button>
      </Tooltip>
    );
  };

  if (isLoading) return <Skeleton width="25%" />;

  return (
    <div className="split">
      <Switch
        id="lvm"
        label={_("Use logical volume management (LVM)")}
        isReversed
        isChecked={isChecked}
        onChange={onChange}
      />
      <If condition={isChecked} then={<LVMSettingsButton />} />
      <Popup
        aria-label={_("LVM settings")}
        title={_("System Volume Group")}
        description={description}
        isOpen={isFormOpen}
      >
        <LVMSettingsForm
          id="lvmSettingsForm"
          devices={devices}
          settings={settings}
          onSubmit={onSubmitForm}
          onValidate={onValidateForm}
        />
        <Popup.Actions>
          <Popup.Confirm
            form="lvmSettingsForm"
            type="submit"
            isDisabled={!isFormValid}
          >
            {_("Accept")}
          </Popup.Confirm>
          <Popup.Cancel onClick={closeForm} />
        </Popup.Actions>
      </Popup>
    </div>
  );
};

/**
 * Form for configuring the encryption password.
 * @component
 *
 * @param {object} props
 * @param {string} props.id - Form ID.
 * @param {string} props.password - Password for encryption.
 * @param {onSubmitFn} [props.onSubmit=noop] - On submit callback.
 * @param {onValidateFn} [props.onValidate=noop] - On validate callback.
 *
 * @callback onSubmitFn
 * @param {string} password
 *
 * @callback onValidateFn
 * @param {boolean} valid
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
        id="encryptionPasswordInput"
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
 * @param {boolean} [props.isChecked=false] - Whether encryption is selected
 * @param {boolean} [props.isLoading=false] - Whether to show the selector as loading
 * @param {onChangeFn} [props.onChange=noop] - On change callback
 *
 * @callback onChangeFn
 * @param {object} settings
 */
const EncryptionField = ({
  password: passwordProp = "",
  method: methodProp = "",
  methods,
  isChecked: isCheckedProp = false,
  isLoading = false,
  onChange = noop
}) => {
  const [isChecked, setIsChecked] = useState(isCheckedProp);
  const [password, setPassword] = useState(passwordProp);
  const [method, setMethod] = useState(methodProp);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isFormValid, setIsFormValid] = useState(true);

  const openForm = () => setIsFormOpen(true);

  const closeForm = () => setIsFormOpen(false);

  const acceptForm = (newPassword, newMethod) => {
    closeForm();
    setPassword(newPassword);
    setMethod(newMethod);
    onChange({ isChecked, password: newPassword, method: newMethod });
  };

  const cancelForm = () => {
    closeForm();
    if (password.length === 0) setIsChecked(false);
  };

  const validateForm = (valid) => setIsFormValid(valid);

  const changeSelected = (_, value) => {
    setIsChecked(value);

    if (value && password.length === 0) openForm();

    if (!value) {
      setPassword("");
      onChange({ isChecked: false, password: "" });
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
        { isChecked && <ChangeSettingsButton /> }
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
 * @param {object} props
 * @param {ProposalSettings} props.settings
 * @param {StorageDevice[]} [props.availableDevices=[]]
 * @param {Volume[]} [props.volumeTemplates=[]]
 * @param {String[]} [props.encryptionMethods=[]]
 * @param {boolean} [isLoading=false]
 * @param {onChangeFn} [props.onChange=noop]
 *
 * @callback onChangeFn
 * @param {object} settings
 */
export default function ProposalSettingsSection({
  settings,
  availableDevices = [],
  volumeTemplates = [],
  encryptionMethods = [],
  isLoading = false,
  onChange = noop
}) {
  const changeLVM = ({ lvm, vgDevices }) => {
    const settings = {};
    if (lvm !== undefined) settings.lvm = lvm;
    if (vgDevices !== undefined) settings.systemVGDevices = vgDevices;

    onChange(settings);
  };

  const changeEncryption = ({ password, method }) => {
    onChange({ encryptionPassword: password, encryptionMethod: method });
  };

  const changeVolumes = (volumes) => {
    onChange({ volumes });
  };

  const encryption = settings.encryptionPassword !== undefined && settings.encryptionPassword.length > 0;

  return (
    <>
      <Section title={_("Settings")} className="flex-stack">
        <LVMField
          settings={settings}
          devices={availableDevices}
          isChecked={settings.lvm === true}
          isLoading={settings.lvm === undefined}
          onChange={changeLVM}
        />
        <EncryptionField
          password={settings.encryptionPassword || ""}
          method={settings.encryptionMethod}
          methods={encryptionMethods}
          isChecked={encryption}
          isLoading={settings.encryptionPassword === undefined}
          onChange={changeEncryption}
        />
        <ProposalVolumes
          volumes={settings.volumes || []}
          templates={volumeTemplates}
          options={{ lvm: settings.lvm, encryption }}
          isLoading={isLoading && settings.volumes === undefined}
          onChange={changeVolumes}
        />
      </Section>
    </>
  );
}
