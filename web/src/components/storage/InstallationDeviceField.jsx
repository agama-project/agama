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

import React from "react";
import { Link } from "react-router-dom";
import { Skeleton } from "@patternfly/react-core";
import { CardField } from "~/components/core";
import { _ } from "~/i18n";
import { deviceLabel } from '~/components/storage/utils';
import { sprintf } from "sprintf-js";

/**
 * @typedef {import ("~/client/storage").ProposalTarget} ProposalTarget
 * @typedef {import ("~/client/storage").StorageDevice} StorageDevice
 */

const LABEL = _("Installation device");
// TRANSLATORS: The storage "Installation device" field's description.
const DESCRIPTION = _("Main disk or LVM Volume Group for installation.");

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
  isLoading,
}) {
  let value;
  if (isLoading || !target)
    value = <Skeleton fontSize="sm" width="75%" />;
  else
    value = targetValue(target, targetDevice, targetPVDevices);

  return (
    <CardField
      label={LABEL}
      description={DESCRIPTION}
      value={value}
      actions={
        isLoading ? <Skeleton fontSize="sm" width="100px" /> : <Link to="target-device">{_("Change")}</Link>
      }
    />
  );
}
