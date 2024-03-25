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

import React, { useEffect, useState } from "react";
import {
  Button,
  Form,
  Skeleton,
} from "@patternfly/react-core";

import { _ } from "~/i18n";
import { If, Section, Popup } from "~/components/core";
import { DeviceSelector } from "~/components/storage";
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
  const [device, setDevice] = useState();
  const [isFormOpen, setIsFormOpen] = useState(false);

  const openForm = () => setIsFormOpen(true);

  const closeForm = () => setIsFormOpen(false);

  const acceptForm = (selectedDevice) => {
    closeForm();
    setDevice(selectedDevice);
    onChange(selectedDevice);
  };

  useEffect(() => {
    setDevice(devices.find(d => d.name === current));
  }, [current, devices, setDevice]);

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
  const targetDevice = settings.targetDevice;

  const changeBootDevice = (device) => {
    if (device.name !== targetDevice) {
      onChange({ targetDevice: device.name });
    }
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
    </Section>
  );
}
