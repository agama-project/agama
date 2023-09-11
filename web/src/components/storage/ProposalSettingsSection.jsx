/*
 * Copyright (c) [2022-2023] SUSE LLC
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
  Button,
  Form, Skeleton, Switch,
  Tooltip
} from "@patternfly/react-core";

import { _ } from "~/i18n";
import { If, PasswordAndConfirmationInput, Section, Popup } from "~/components/core";
import { DeviceSelector, ProposalVolumes } from "~/components/storage";
import { deviceLabel } from '~/components/storage/utils';
import { Icon } from "~/components/layout";
import { noop } from "~/utils";

/**
 * @typedef {import ("~/clients/storage").ProposalSettings} ProposalSettings
 * @typedef {import ("~/clients/storage").StorageDevice} StorageDevice
 * @typedef {import ("~/clients/storage").Volume} Volume
 */

/**
 * Form for selecting the installation device
 * @component
 *
 * @param {object} props
 * @param {string} props.id - Form ID
 * @param {string|undefined} props.current - Device name, if any
 * @param {StorageDevice[]} props.devices - Available devices for the selection
 * @param {onSubmitFn} props.onSubmit - On submit callback
 *
 * @callback onSubmitFn
 * @param {string} device
 */
const InstallationDeviceForm = ({ id, current, devices, onSubmit }) => {
  const [device, setDevice] = useState(current);

  useEffect(() => {
    const isCurrentValid = () => {
      return devices.find(d => d.name === current) !== undefined;
    };

    if (!isCurrentValid()) setDevice(devices[0]?.name);
  }, [current, devices]);

  const submitForm = (e) => {
    e.preventDefault();
    if (device !== undefined) onSubmit(device);
  };

  const selectDevice = (d) => setDevice(d.name);

  const selected = devices.find(d => d.name === device);

  return (
    <Form id={id} onSubmit={submitForm}>
      <DeviceSelector
        selected={selected}
        devices={devices}
        onSelect={selectDevice}
      />
    </Form>
  );
};

/**
 * Allows to select the installation device
 * @component
 *
 * @param {object} props
 * @param {string|undefined} props.current - Device name, if any
 * @param {StorageDevice[]} props.devices - Available devices for the selection
 * @param {boolean} props.isLoading - Whether to show the selector as loading
 * @param {onChangeFn} props.onChange - On change callback
 *
 * @callback onChangeFn
 * @param {string} device
 */
const InstallationDeviceField = ({ current, devices, isLoading, onChange }) => {
  const [device, setDevice] = useState(current);
  const [isFormOpen, setIsFormOpen] = useState(false);

  const openForm = () => setIsFormOpen(true);

  const closeForm = () => setIsFormOpen(false);

  const acceptForm = (newDevice) => {
    closeForm();
    setDevice(newDevice);
    onChange(newDevice);
  };

  const DeviceContent = ({ device }) => {
    const text = (deviceName) => {
      if (!deviceName || deviceName.length === 0) return _("No device selected yet");

      const device = devices.find(d => d.name === deviceName);
      return device ? deviceLabel(device) : deviceName;
    };

    return <Button variant="link" isInline onClick={openForm}>{text(device)}</Button>;
  };

  if (isLoading) {
    return <Skeleton width="25%" />;
  }

  const description = _("Select the device for installing the system. All the \
file systems will be created on the selected device.");

  return (
    <>
      <div className="split">
        <span>{_("Installation device")}</span>
        <DeviceContent device={device} />
      </div>
      <Popup
        title={_("Installation device")}
        description={description}
        isOpen={isFormOpen}
      >
        <If
          condition={devices.length === 0}
          then={<div className="bold">{_("No devices found")}</div>}
          else={
            <InstallationDeviceForm
              id="bootDeviceForm"
              current={device}
              devices={devices}
              onSubmit={acceptForm}
            />
          }
        />
        <Popup.Actions>
          <Popup.Confirm
            form="bootDeviceForm"
            type="submit"
            isDisabled={devices.length === 0}
          >
            {_("Accept")}
          </Popup.Confirm>
          <Popup.Cancel onClick={closeForm} />
        </Popup.Actions>
      </Popup>
    </>
  );
};

/**
 * Allows to select LVM
 * @component
 *
 * @param {object} props
 * @param {boolean} props.selected - Whether LVM is selected
 * @param {boolean} props.isLoading - Whether to show the selector as loading
 * @param {onChangeFn} props.onChange - On change callback
 *
 * @callback onChangeFn
 * @param {boolean} lvm
 */
const LVMField = ({ selected: selectedProp, isLoading, onChange }) => {
  const [selected, setSelected] = useState(selectedProp);

  const onUseLVMChange = (_, value) => {
    setSelected(value);
    onChange(value);
  };

  if (isLoading) return <Skeleton width="25%" />;

  return (
    <Switch
      id="lvm"
      label={_("Use logical volume management (LVM)")}
      isReversed
      isChecked={selected}
      onChange={onUseLVMChange}
    />
  );
};

/**
 * Form for configuring the encryption password
 * @component
 *
 * @param {object} props
 * @param {string} props.id - Form ID
 * @param {string} props.password - Password for encryption
 * @param {onSubmitFn} props.onSubmit - On submit callback
 * @param {onValidateFn} props.onValidate - On validate callback
 *
 * @callback onSubmitFn
 * @param {string} password
 *
 * @callback onValidateFn
 * @param {boolean} valid
 */
const EncryptionPasswordForm = ({ id, password: passwordProp, onSubmit, onValidate }) => {
  const [password, setPassword] = useState(passwordProp || "");

  useEffect(() => {
    if (password.length === 0) onValidate(false);
  }, [password, onValidate]);

  const changePassword = (_, v) => setPassword(v);

  const submitForm = (e) => {
    e.preventDefault();
    onSubmit(password);
  };

  return (
    <Form id={id} onSubmit={submitForm}>
      <PasswordAndConfirmationInput
        id="encryptionPasswordInput"
        value={password}
        onChange={changePassword}
        onValidation={onValidate}
      />
    </Form>
  );
};

/**
 * Allows to selected encryption
 * @component
 *
 * @param {object} props
 * @param {boolean} props.selected - Whether encryption is selected
 * @param {string} props.password - Password for encryption
 * @param {boolean} props.isLoading - Whether to show the selector as loading
 * @param {onChangeFn} props.onChange - On change callback
 *
 * @callback onChangeFn
 * @param {object} settings
 */
const EncryptionPasswordField = ({ selected: selectedProp, password: passwordProp, isLoading, onChange }) => {
  const [selected, setSelected] = useState(selectedProp);
  const [password, setPassword] = useState(passwordProp);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isFormValid, setIsFormValid] = useState(true);

  const openForm = () => setIsFormOpen(true);

  const closeForm = () => setIsFormOpen(false);

  const acceptForm = (newPassword) => {
    closeForm();
    setPassword(newPassword);
    onChange({ selected, password: newPassword });
  };

  const cancelForm = () => {
    closeForm();
    if (password.length === 0) setSelected(false);
  };

  const validateForm = (valid) => setIsFormValid(valid);

  const onUseEncryptionChange = (_, value) => {
    setSelected(value);

    if (value && password.length === 0) openForm();

    if (!value) {
      setPassword("");
      onChange({ selected: false, password: "" });
    }
  };

  const ChangePasswordButton = () => {
    return (
      <Tooltip
        content={_("Change encryption password")}
        entryDelay={400}
        exitDelay={50}
        position="right"
      >
        <button aria-label={_("Encryption settings")} className="plain-control" onClick={openForm}>
          <Icon name="tune" size={24} />
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
          isChecked={selected}
          onChange={onUseEncryptionChange}
        />
        { selected && <ChangePasswordButton /> }
      </div>
      <Popup aria-label={_("Encryption settings")} title={_("Encryption settings")} isOpen={isFormOpen}>
        <EncryptionPasswordForm
          id="encryptionPasswordForm"
          password={password}
          onSubmit={acceptForm}
          onValidate={validateForm}
        />
        <Popup.Actions>
          <Popup.Confirm form="encryptionPasswordForm" type="submit" isDisabled={!isFormValid}>{_("Accept")}</Popup.Confirm>
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
 * @param {StorageDevice[]} [props.availableDevices=[]]
 * @param {Volume[]} [props.volumeTemplates=[]]
 * @param {ProposalSettings} [props.settings={}]
 * @param {boolean} [isLoading=false]
 * @param {onChangeFn} [props.onChange=noop]
 *
 * @callback onChangeFn
 * @param {object} settings
 */
export default function ProposalSettingsSection({
  availableDevices = [],
  volumeTemplates = [],
  settings = {},
  isLoading = false,
  onChange = noop
}) {
  const changeBootDevice = (device) => {
    if (onChange === noop) return;
    onChange({ bootDevice: device });
  };

  const changeLVM = (lvm) => {
    if (onChange === noop) return;
    onChange({ lvm });
  };

  const changeEncryption = ({ password }) => {
    if (onChange === noop) return;
    onChange({ encryptionPassword: password });
  };

  const changeVolumes = (volumes) => {
    if (onChange === noop) return;
    onChange({ volumes });
  };

  const { bootDevice } = settings;
  const encryption = settings.encryptionPassword !== undefined && settings.encryptionPassword.length > 0;

  return (
    <Section title={_("Settings")} className="flex-stack">
      <InstallationDeviceField
        current={bootDevice}
        devices={availableDevices}
        isLoading={isLoading && bootDevice === undefined}
        onChange={changeBootDevice}
      />
      <LVMField
        selected={settings.lvm === true}
        isLoading={settings.lvm === undefined}
        onChange={changeLVM}
      />
      <EncryptionPasswordField
        selected={encryption}
        password={settings.encryptionPassword || ""}
        onChange={changeEncryption}
        isLoading={settings.encryptionPassword === undefined}
      />
      <ProposalVolumes
        volumes={settings.volumes || []}
        templates={volumeTemplates}
        options={{ lvm: settings.lvm, encryption }}
        isLoading={isLoading}
        onChange={changeVolumes}
      />
    </Section>
  );
}
