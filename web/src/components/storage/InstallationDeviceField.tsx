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
import { Skeleton } from "@patternfly/react-core";
import { Link, CardField } from "~/components/core";
import { deviceLabel } from "~/components/storage/utils";
import { PATHS } from "~/routes/storage";
import { _ } from "~/i18n";
import { sprintf } from "sprintf-js";
import { ProposalTarget, StorageDevice } from "~/types/storage";

const LABEL = _("Installation device");
// TRANSLATORS: The storage "Installation device" field's description.
const DESCRIPTION = _("Main disk or LVM Volume Group for installation.");

/**
 * Generates the target value.
 */
const targetValue = (target: ProposalTarget, targetDevice: StorageDevice, targetPVDevices: StorageDevice[]): string => {
  if (target === ProposalTarget.DISK && targetDevice) {
    // TRANSLATORS: %s is the installation disk (eg. "/dev/sda, 80 GiB)
    return sprintf(_("File systems created as new partitions at %s"), deviceLabel(targetDevice));
  }
  if (ProposalTarget.NEW_LVM_VG && targetPVDevices.length > 0) {
    if (targetPVDevices.length > 1) return _("File systems created at a new LVM volume group");

    if (targetPVDevices.length === 1) {
      // TRANSLATORS: %s is the disk used for the LVM physical volumes (eg. "/dev/sda, 80 GiB)
      return sprintf(
        _("File systems created at a new LVM volume group on %s"),
        deviceLabel(targetPVDevices[0]),
      );
    }
  }

  return _("No device selected yet");
};

/**
 * Allows to select the installation device.
 * @component
 */

export type TargetConfig = {
  target: ProposalTarget;
  targetDevice: StorageDevice | undefined;
  targetPVDevices: StorageDevice[];
}

export type InstallationDeviceFieldProps = {
  // Installation target
  target: ProposalTarget | undefined;
  // Target device (for target "disk")
  targetDevice: StorageDevice | undefined;
  // Target devices for the LVM volume group (target "newLvmVg")
  targetPVDevices: StorageDevice[];
  // Available devices for installation.
  devices: StorageDevice[];
  isLoading: boolean;
  onChange: (target: TargetConfig) => void
}

export default function InstallationDeviceField({
  target,
  targetDevice,
  targetPVDevices,
  isLoading,
}: InstallationDeviceFieldProps) {
  let value: React.ReactNode;
  if (isLoading || !target) value = <Skeleton fontSize="sm" width="75%" />;
  else value = targetValue(target, targetDevice, targetPVDevices);

  return (
    <CardField
      label={LABEL}
      description={DESCRIPTION}
      actions={
        isLoading ? (
          <Skeleton fontSize="sm" width="100px" />
        ) : (
          <Link to={PATHS.targetDevice} isPrimary={false}>
            {_("Change")}
          </Link>
        )
      }
    >
      <CardField.Content isFilled={false}>{value}</CardField.Content>
    </CardField>
  );
}
