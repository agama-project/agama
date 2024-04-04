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
import {
  Button,
  Skeleton,
} from "@patternfly/react-core";

import { _ } from "~/i18n";
import { DeviceSelectionDialog } from "~/components/storage";
import { deviceLabel } from '~/components/storage/utils';
import { If, Section } from "~/components/core";
import { sprintf } from "sprintf-js";
import { compact, noop } from "~/utils";

/**
 * @typedef {import ("~/client/storage").ProposalSettings} ProposalSettings
 * @typedef {import ("~/client/storage").StorageDevice} StorageDevice
 */

/**
 * Renders a button that allows changing the target device for installation.
 *
 * @param {object} props
 * @param {string} props.target
 * @param {StorageDevice|undefined} props.targetDevice
 * @param {StorageDevice[]} props.targetPVDevices
 * @param {import("react").MouseEventHandler<HTMLButtonElement>} [props.onClick=noop]
 */
const TargetDeviceButton = ({ target, targetDevice, targetPVDevices, onClick = noop }) => {
  const label = () => {
    if (target === "disk" && targetDevice) return deviceLabel(targetDevice);
    if (target === "newLvmVg" && targetPVDevices.length > 0) {
      if (targetPVDevices.length > 1) return _("new LVM volume group");

      if (targetPVDevices.length === 1) {
        // TRANSLATORS: %s is the disk used for the LVM physical volumes (eg. "/dev/sda, 80 GiB)
        return sprintf(_("new LVM volume group on %s"), deviceLabel(targetPVDevices[0]));
      }
    }

    return _("No device selected yet");
  };

  return (
    <Button variant="link" isInline onClick={onClick}>
      {label()}
    </Button>
  );
};

/**
 * Allows to select the installation device.
 * @component
 *
 * @param {object} props
 * @param {string} props.target - Installation target ("disk", "newLvmVg", "reusedLvmVg").
 * @param {StorageDevice|undefined} props.targetDevice - Target device (for target "disk").
 * @param {StorageDevice[]} props.targetPVDevices - Target devices for the LVM volume group (target "newLvmVg").
 * @param {StorageDevice[]} props.devices - Available devices for installation.
 * @param {boolean} props.isLoading
 * @param {(target: Target) => void} props.onChange
 *
 * @typedef {object} Target
 * @property {string} target
 * @property {StorageDevice|undefined} targetDevice
 * @property {StorageDevice[]} targetPVDevices
 */
const InstallationDeviceField = ({
  target,
  targetDevice,
  targetPVDevices,
  devices,
  isLoading,
  onChange
}) => {
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const openDialog = () => setIsDialogOpen(true);

  const closeDialog = () => setIsDialogOpen(false);

  const onAccept = ({ target, targetDevice, targetPVDevices }) => {
    closeDialog();
    onChange({ target, targetDevice, targetPVDevices });
  };

  if (isLoading) {
    return <Skeleton screenreaderText={_("Waiting for information about selected device")} width="25%" />;
  }

  return (
    <div className="split">
      <span>{_("Installation device")}</span>
      <TargetDeviceButton
        target={target}
        targetDevice={targetDevice}
        targetPVDevices={targetPVDevices}
        onClick={openDialog}
      />
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
    </div>
  );
};

/**
 * Section for editing the target device for installation.
 * @component
 *
 * @param {object} props
 * @param {ProposalSettings} props.settings
 * @param {StorageDevice[]} [props.availableDevices=[]]
 * @param {boolean} [props.isLoading=false]
 * @param {(settings: object) => void} [props.onChange=noop]
 */
export default function ProposalDeviceSection({
  settings,
  availableDevices = [],
  isLoading = false,
  onChange = noop
}) {
  const findDevice = (name) => availableDevices.find(a => a.name === name);

  const target = settings.target;
  const targetDevice = findDevice(settings.targetDevice);
  const targetPVDevices = compact(settings.targetPVDevices?.map(findDevice) || []);

  const changeTarget = ({ target, targetDevice, targetPVDevices }) => {
    onChange({
      target,
      targetDevice: targetDevice?.name,
      targetPVDevices: targetPVDevices.map(d => d.name)
    });
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
      // TRANSLATORS: The storage "Device" section's title.
      title={_("Device")}
      description={<Description />}
    >
      <InstallationDeviceField
        target={target}
        targetDevice={targetDevice}
        targetPVDevices={targetPVDevices}
        devices={availableDevices}
        isLoading={isLoading && target === undefined}
        onChange={changeTarget}
      />
    </Section>
  );
}
