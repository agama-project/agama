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
import { Form } from "@patternfly/react-core";

import { _ } from "~/i18n";
import { deviceChildren } from "~/components/storage/utils";
import { Popup, RadioField } from "~/components/core";
import { DeviceSelectorTable } from "~/components/storage";
import { noop } from "~/utils";

/**
 * @typedef {import ("~/client/storage").ProposalTarget} ProposalTarget
 * @typedef {import ("~/client/storage").ProposalSettings} ProposalSettings
 * @typedef {import ("~/client/storage").StorageDevice} StorageDevice
 */

const Html = ({ children, ...props }) => (
  <div {...props} dangerouslySetInnerHTML={{ __html: children }} />
);

/**
 * Renders a dialog that allows the user to select a target device for installation.
 * @component
 *
 * @param {object} props
 * @param {ProposalTarget} props.target
 * @param {StorageDevice|undefined} props.targetDevice
 * @param {StorageDevice[]} props.targetPVDevices
 * @param {StorageDevice[]} props.devices - The actions to perform in the system.
 * @param {boolean} [props.isOpen=false] - Whether the dialog is visible or not.
 * @param {() => void} [props.onCancel=noop]
 * @param {(target: Target) => void} [props.onAccept=noop]
 *
 * @typedef {object} Target
 * @property {string} target
 * @property {StorageDevice|undefined} targetDevice
 * @property {StorageDevice[]} targetPVDevices

 */
export default function DeviceSelectionDialog({
  target: defaultTarget,
  targetDevice: defaultTargetDevice,
  targetPVDevices: defaultPVDevices,
  devices,
  isOpen,
  onCancel = noop,
  onAccept = noop,
  ...props
}) {
  const [target, setTarget] = useState(defaultTarget);
  const [targetDevice, setTargetDevice] = useState(defaultTargetDevice);
  const [targetPVDevices, setTargetPVDevices] = useState(defaultPVDevices);

  const isTargetDisk = target === "DISK";
  const isTargetNewLvmVg = target === "NEW_LVM_VG";

  const selectTargetDisk = () => setTarget("DISK");
  const selectTargetNewLvmVG = () => setTarget("NEW_LVM_VG");

  const selectTargetDevice = (devices) => setTargetDevice(devices[0]);

  const onSubmit = (e) => {
    e.preventDefault();
    onAccept({ target, targetDevice, targetPVDevices });
  };

  const isAcceptDisabled = () => {
    if (isTargetDisk) return targetDevice === undefined;
    if (isTargetNewLvmVg) return targetPVDevices.length === 0;

    return true;
  };

  const isDeviceSelectable = (device) => device.isDrive || device.type === "md";

  return (
    <Popup
      title={_("Device for installing the system")}
      isOpen={isOpen}
      variant="medium"
      {...props}
    >
      <Form id="target-form" onSubmit={onSubmit}>
        <RadioField
          label={_("Select a disk")}
          // TRANSLATORS: beware the HTML markup (<b> and </b>)
          description={<Html>{_("The file systems will be allocated by default as <b>new partitions in the selected device</b>.")}</Html>}
          iconSize="xs"
          textWrapper="span"
          isChecked={isTargetDisk}
          onClick={selectTargetDisk}
        >
          <DeviceSelectorTable
            aria-label={_("Device selector for target disk")}
            devices={devices}
            selected={[targetDevice]}
            itemChildren={deviceChildren}
            itemSelectable={isDeviceSelectable}
            onSelectionChange={selectTargetDevice}
            variant="compact"
            className={isTargetDisk ? undefined : "hidden"}
          />
        </RadioField>
        <RadioField
          label={_("Create an LVM Volume Group")}
          // TRANSLATORS: beware the HTML markup (<b> and </b>)
          description={
            <Html>
              {
                // TRANSLATORS: beware the HTML markup (<b> and </b>)
                _("The file systems will be allocated by default as <b>logical volumes of a new LVM Volume \
Group</b>. The corresponding physical volumes will be created on demand as new partitions at the selected devices.")
              }
            </Html>
          }
          iconSize="xs"
          textWrapper="span"
          isChecked={isTargetNewLvmVg}
          onClick={selectTargetNewLvmVG}
        >
          <DeviceSelectorTable
            aria-label={_("Device selector for new LVM volume group")}
            isMultiple
            devices={devices}
            selected={targetPVDevices}
            itemChildren={deviceChildren}
            itemSelectable={isDeviceSelectable}
            onSelectionChange={setTargetPVDevices}
            variant="compact"
            className={isTargetNewLvmVg ? undefined : "hidden"}
          />
        </RadioField>
      </Form>
      <Popup.Actions>
        <Popup.Confirm form="target-form" type="submit" isDisabled={isAcceptDisabled()} />
        <Popup.Cancel onClick={onCancel} />
      </Popup.Actions>
    </Popup>
  );
}
