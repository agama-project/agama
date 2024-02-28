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

import React, { useState } from "react";
import {
  Button,
  Form,
  Skeleton,
  Switch,
  ToggleGroup, ToggleGroupItem,
  Tooltip
} from "@patternfly/react-core";

import { _ } from "~/i18n";
import { Icon } from "~/components/layout";
import { If, Section, Popup } from "~/components/core";
import { DeviceList, DeviceSelector } from "~/components/storage";
import { deviceLabel } from '~/components/storage/utils';
import { noop } from "~/utils";

/**
 * @typedef {import ("~/client/storage").ProposalManager.ProposalSettings} ProposalSettings
 * @typedef {import ("~/client/storage").DevicesManager.StorageDevice} StorageDevice
 */

/**
 * Form for selecting the installation device.
 * @component
 *
 * @param {object} props
 * @param {string} props.id - Form ID.
 * @param {StorageDevice} [props.current] - Currently selected device, if any.
 * @param {StorageDevice[]} [props.devices=[]] - Available devices for the selection.
 * @param {onSubmitFn} [props.onSubmit=noop] - On submit callback.
 *
 * @callback onSubmitFn
 * @param {string} device - Name of the selected device.
 */
const InstallationDeviceForm = ({
  id,
  current,
  devices = [],
  onSubmit = noop
}) => {
  const [device, setDevice] = useState(current || devices[0]);

  const changeSelected = (deviceId) => {
    setDevice(devices.find(d => d.sid === deviceId));
  };

  const submitForm = (e) => {
    e.preventDefault();
    if (device !== undefined) onSubmit(device);
  };

  return (
    <Form id={id} onSubmit={submitForm}>
      <DeviceSelector
        selected={device}
        devices={devices}
        onChange={changeSelected}
      />
    </Form>
  );
};

/**
 * Allows to select the installation device.
 * @component
 *
 * @callback onChangeFn
 * @param {string} device - Name of the selected device.
 *
 * @param {object} props
 * @param {string} [props.current] - Device name, if any.
 * @param {StorageDevice[]} [props.devices=[]] - Available devices for the selection.
 * @param {boolean} [props.isLoading=false] - Whether to show the selector as loading.
 * @param {onChangeFn} [props.onChange=noop] - On change callback.
 */
const InstallationDeviceField = ({
  current,
  devices = [],
  isLoading = false,
  onChange = noop
}) => {
  const [device, setDevice] = useState(devices.find(d => d.name === current));
  const [isFormOpen, setIsFormOpen] = useState(false);

  const openForm = () => setIsFormOpen(true);

  const closeForm = () => setIsFormOpen(false);

  const acceptForm = (selectedDevice) => {
    closeForm();
    setDevice(selectedDevice);
    onChange(selectedDevice);
  };

  /**
   * Renders a button that allows changing selected device
   *
   * NOTE: if a device is already selected, its name and size will be used for
   * the button text. Otherwise, a "No device selected" text will be shown.
   *
   * @param {object} props
   * @param {StorageDevice|undefined} [props.current] - Currently selected device, if any.
   */
  const DeviceContent = ({ device }) => {
    return (
      <Button variant="link" isInline onClick={openForm}>
        {device ? deviceLabel(device) : _("No device selected yet")}
      </Button>
    );
  };

  if (isLoading) {
    return <Skeleton screenreaderText={_("Waiting for information about selected device")} width="25%" />;
  }

  const description = _("Select the device for installing the system.");

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
          then={_("No devices found.")}
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
    const { targetDevice } = settings;
    const customDevices = (vgDevices.length === 0 && !editedDevices) ? [targetDevice] : vgDevices;
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
    const targetDevice = devices.find(d => d.name === settings.targetDevice);

    // FIXME: In this case, should be a "readOnly" selector.
    return <DeviceList devices={[targetDevice]} />;
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

  if (isLoading) return <Skeleton screenreaderText={_("Waiting for information about LVM")} width="25%" />;

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
 * Section for editing the selected device
 * @component
 *
 * @callback onChangeFn
 * @param {object} settings
 *
 * @param {object} props
 * @param {ProposalSettings} props.settings
 * @param {StorageDevice[]} [props.availableDevices=[]]
 * @param {boolean} [isLoading=false]
 * @param {onChangeFn} [props.onChange=noop]
 */
export default function ProposalDeviceSection({
  settings,
  availableDevices = [],
  isLoading = false,
  onChange = noop
}) {
  // FIXME: we should work with devices objects ASAP
  const { targetDevice } = settings;

  const changeBootDevice = (device) => {
    if (device.name !== targetDevice) {
      onChange({ targetDevice: device.name });
    }
  };

  const changeLVM = ({ lvm, vgDevices }) => {
    const settings = {};
    if (lvm !== undefined) settings.lvm = lvm;
    if (vgDevices !== undefined) settings.systemVGDevices = vgDevices;

    onChange(settings);
  };

  const Description = () => (
    <span
      dangerouslySetInnerHTML={{
        // TRANSLATORS: The storage "Device" sections's description. Do not
        // translate 'abbr' and 'title', they are part of the HTML markup.
        __html: _("Select the main disk or <abbr title='Logical Volume Manager'>LVM</abbr> \
Volume Group for installation.")
      }}
    />
  );

  return (
    <Section
      // TRANSLATORS: The storage "Device" section's title
      title={_("Device")}
      description={<Description />}
    >
      <InstallationDeviceField
        current={targetDevice}
        devices={availableDevices}
        isLoading={isLoading && targetDevice === undefined}
        onChange={changeBootDevice}
      />
      <LVMField
        settings={settings}
        devices={availableDevices}
        isChecked={settings.lvm === true}
        isLoading={settings.lvm === undefined}
        onChange={changeLVM}
      />
    </Section>
  );
}
