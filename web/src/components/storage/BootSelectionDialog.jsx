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
import { Form } from "@patternfly/react-core";
import { _ } from "~/i18n";
import { DevicesFormSelect } from "~/components/storage";
import { noop } from "~/utils";
import { Popup, RadioField } from "~/components/core";
import { deviceLabel } from "~/components/storage/utils";
import { sprintf } from "sprintf-js";

// @ts-check

/**
 * @typedef {import ("~/client/storage").StorageDevice} StorageDevice
 */

/**
 * Renders a dialog that allows the user to select the boot configuration.
 * @component
 *
 * @typedef {object} Boot
 * @property {boolean} configureBoot
 * @property {StorageDevice|undefined} bootDevice
 *
 * @param {object} props
 * @param {boolean} props.configureBoot - Whether the boot is configurable
 * @param {StorageDevice|undefined} props.bootDevice - Currently selected booting device.
 * @param {StorageDevice|undefined} props.defaultBootDevice - Default booting device.
 * @param {StorageDevice[]} props.devices - Devices that user can select to boot from.
 * @param {boolean} [props.isOpen=false] - Whether the dialog is visible or not.
 * @param {function} [props.onCancel=noop]
 * @param {(boot: Boot) => void} [props.onAccept=noop]
 */
export default function BootSelectionDialog({
  configureBoot: configureBootProp,
  bootDevice: bootDeviceProp,
  defaultBootDevice,
  devices,
  isOpen,
  onCancel = noop,
  onAccept = noop,
  ...props
}) {
  const [configureBoot, setConfigureBoot] = useState(configureBootProp);
  const [bootDevice, setBootDevice] = useState(bootDeviceProp || defaultBootDevice);
  const [isBootAuto, setIsBootAuto] = useState(configureBootProp && bootDeviceProp === undefined);

  const isBootManual = configureBoot && !isBootAuto;

  const selectBootAuto = () => {
    setConfigureBoot(true);
    setIsBootAuto(true);
  };

  const selectBootManual = () => {
    setConfigureBoot(true);
    setIsBootAuto(false);
  };

  const selectBootDisabled = () => {
    setConfigureBoot(false);
    setIsBootAuto(false);
  };

  const onSubmit = (e) => {
    e.preventDefault();
    const device = isBootAuto ? undefined : bootDevice;
    onAccept({ configureBoot, bootDevice: device });
  };

  const isAcceptDisabled = () => {
    return isBootManual && bootDevice === undefined;
  };

  const description = _(
    "To ensure the new system is able to boot, the installer may need to create or configure some \
partitions in the appropriate disk."
  );

  const automaticText = () => {
    if (!defaultBootDevice) {
      return _("Partitions to boot will be allocated at the installation disk.");
    }

    return sprintf(
      // TRANSLATORS: %s is replaced by a device name and size (e.g., "/dev/sda, 500GiB")
      _("Partitions to boot will be allocated at the installation disk (%s)."),
      deviceLabel(defaultBootDevice)
    );
  };

  return (
    <Popup
      title={_("Partitions for booting")}
      description={description}
      isOpen={isOpen}
      {...props}
    >
      <Form id="boot-form" onSubmit={onSubmit}>
        <RadioField
          label={_("Automatic")}
          description={automaticText()}
          iconSize="xs"
          textWrapper="span"
          isChecked={isBootAuto}
          onClick={selectBootAuto}
        />

        <RadioField
          label={_("Select a disk")}
          description={_("Partitions to boot will be allocated at the following device.")}
          iconSize="xs"
          textWrapper="span"
          isChecked={isBootManual}
          onClick={selectBootManual}
        >
          <DevicesFormSelect
            aria-label={_("Choose a disk for placing the boot loader")}
            devices={devices}
            selectedDevice={bootDevice}
            onChange={setBootDevice}
            isDisabled={!isBootManual}
          />
        </RadioField>

        <RadioField
          label={_("Do not configure")}
          description={_("No partitions will be automatically configured for booting. Use with caution.")}
          iconSize="xs"
          textWrapper="span"
          isChecked={!configureBoot}
          onClick={selectBootDisabled}
        />
      </Form>
      <Popup.Actions>
        <Popup.Confirm form="boot-form" type="submit" isDisabled={isAcceptDisabled()} />
        <Popup.Cancel onClick={onCancel} />
      </Popup.Actions>
    </Popup>
  );
}
