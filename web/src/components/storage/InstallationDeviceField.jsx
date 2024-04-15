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

import React, { useState } from "react";
import { Skeleton } from "@patternfly/react-core";

import { _ } from "~/i18n";
import { DeviceSelectionDialog, ProposalPageMenu } from "~/components/storage";
import { deviceLabel } from '~/components/storage/utils';
import { If, SettingsField } from "~/components/core";
import { sprintf } from "sprintf-js";

/**
 * @typedef {import ("~/client/storage").ProposalTarget} ProposalTarget
 * @typedef {import ("~/client/storage").StorageDevice} StorageDevice
 */

/**
 * Generates the target value.
 * @function
 *
 * @param {ProposalTarget} target
 * @param {StorageDevice} targetDevice
 * @param {StorageDevice[]} targetPVDevices
 * @returns {string}
 */
const targetValue = (target, targetDevice, targetPVDevices) => {
  if (target === "DISK" && targetDevice) return deviceLabel(targetDevice);
  if (target === "NEW_LVM_VG" && targetPVDevices.length > 0) {
    if (targetPVDevices.length > 1) return _("new LVM volume group");

    if (targetPVDevices.length === 1) {
      // TRANSLATORS: %s is the disk used for the LVM physical volumes (eg. "/dev/sda, 80 GiB)
      return sprintf(_("new LVM volume group on %s"), deviceLabel(targetPVDevices[0]));
    }
  }

  return _("No device selected yet");
};

/**
 * Field description.
 * @function
 *
 * @returns {React.ReactElement}
 */
const renderDescription = () => (
  <span
    dangerouslySetInnerHTML={{
      // TRANSLATORS: The storage "Device" sections's description. Do not translate 'abbr' and
      // 'title', they are part of the HTML markup.
      __html: _("Select the main disk or <abbr title='Logical Volume Manager'>LVM</abbr> \
Volume Group for installation.")
    }}
  />
);

const StorageTechSelector = () => {
  return (
    <ProposalPageMenu label={_("storage technologies")} />
  );
};

/**
 * Allows to select the installation device.
 * @component
 *
 * @typedef {object} InstallationDeviceFieldProps
 * @property {ProposalTarget|undefined} target - Installation target
 * @property {StorageDevice|undefined} targetDevice - Target device (for target "DISK").
 * @property {StorageDevice[]} targetPVDevices - Target devices for the LVM volume group (target "NEW_LVM_VG").
 * @property {StorageDevice[]} devices - Available devices for installation.
 * @property {boolean} isLoading
 * @property {(target: TargetConfig) => void} onChange
 *
 * @typedef {object} TargetConfig
 * @property {ProposalTarget} target
 * @property {StorageDevice|undefined} targetDevice
 * @property {StorageDevice[]} targetPVDevices
 *
 * @param {InstallationDeviceFieldProps} props
 */

export default function InstallationDeviceField({
  target,
  targetDevice,
  targetPVDevices,
  devices,
  isLoading,
  onChange
}) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const openDialog = () => setIsDialogOpen(true);

  const closeDialog = () => setIsDialogOpen(false);

  const onAccept = ({ target, targetDevice, targetPVDevices }) => {
    closeDialog();
    onChange({ target, targetDevice, targetPVDevices });
  };

  let value;
  if (isLoading || !target)
    value = <Skeleton screenreaderText={_("Waiting for information about selected device")} width="25%" />;
  else
    value = targetValue(target, targetDevice, targetPVDevices);

  return (
    <SettingsField
      label={_("Installation device")}
      value={value}
      description={renderDescription()}
      onClick={openDialog}
    >
      {_("Prepare more devices by configuring advanced")} <StorageTechSelector />
      <If
        condition={isDialogOpen}
        then={
          <DeviceSelectionDialog
            isOpen
            target={target}
            targetDevice={targetDevice}
            targetPVDevices={targetPVDevices}
            devices={devices}
            onAccept={onAccept}
            onCancel={closeDialog}
          />
        }
      />
    </SettingsField>
  );
}
