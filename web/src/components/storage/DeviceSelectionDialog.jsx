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
import { ControlledPanels as Panels, Popup } from "~/components/core";
import { DeviceSelectorTable } from "~/components/storage";
import { noop } from "~/utils";

/**
 * @typedef {import ("~/client/storage").ProposalTarget} ProposalTarget
 * @typedef {import ("~/client/storage").ProposalSettings} ProposalSettings
 * @typedef {import ("~/client/storage").StorageDevice} StorageDevice
 */

const SELECT_DISK_ID = "select-disk";
const CREATE_LVM_ID = "create-lvm";
const SELECT_DISK_PANEL_ID = "panel-for-disk-selection";
const CREATE_LVM_PANEL_ID = "panel-for-lvm-creation";
const OPTIONS_NAME = "selection-mode";

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

  // TRANSLATORS: description for using plain partitions for installing the
  // system, the text in the square brackets [] is displayed in bold, use only
  // one pair in the translation
  const [msgStart1, msgBold1, msgEnd1] = _("The file systems will be allocated \
by default as [new partitions in the selected device].").split(/[[\]]/);
  // TRANSLATORS: description for using logical volumes for installing the
  // system, the text in the square brackets [] is displayed in bold, use only
  // one pair in the translation
  const [msgStart2, msgBold2, msgEnd2] = _("The file systems will be allocated \
by default as [logical volumes of a new LVM Volume Group]. The corresponding \
physical volumes will be created on demand as new partitions at the selected \
devices.").split(/[[\]]/);

  return (
    <Popup
      title={_("Device for installing the system")}
      isOpen={isOpen}
      variant="medium"
      {...props}
    >
      <Form id="target-form" onSubmit={onSubmit}>
        <Panels className="stack">
          <Panels.Options data-variant="buttons">
            <Panels.Option
              id={SELECT_DISK_ID}
              name={OPTIONS_NAME}
              isSelected={isTargetDisk}
              onChange={selectTargetDisk}
              controls={SELECT_DISK_PANEL_ID}
            >
              {_("Select a disk")}
            </Panels.Option>
            <Panels.Option
              id={CREATE_LVM_ID}
              name={OPTIONS_NAME}
              isSelected={isTargetNewLvmVg}
              onChange={selectTargetNewLvmVG}
              controls={CREATE_LVM_PANEL_ID}
            >
              {_("Create an LVM Volume Group")}
            </Panels.Option>
          </Panels.Options>

          <Panels.Panel id={SELECT_DISK_PANEL_ID} isExpanded={isTargetDisk}>
            {msgStart1}
            <b>{msgBold1}</b>
            {msgEnd1}

            <DeviceSelectorTable
              aria-label={_("Device selector for target disk")}
              devices={devices}
              selected={[targetDevice]}
              itemChildren={deviceChildren}
              itemSelectable={isDeviceSelectable}
              onSelectionChange={selectTargetDevice}
              variant="compact"
            />
          </Panels.Panel>

          <Panels.Panel id={CREATE_LVM_PANEL_ID} isExpanded={isTargetNewLvmVg} className="stack">
            {msgStart2}
            <b>{msgBold2}</b>
            {msgEnd2}

            <DeviceSelectorTable
              aria-label={_("Device selector for new LVM volume group")}
              isMultiple
              devices={devices}
              selected={targetPVDevices}
              itemChildren={deviceChildren}
              itemSelectable={isDeviceSelectable}
              onSelectionChange={setTargetPVDevices}
              variant="compact"
            />
          </Panels.Panel>
        </Panels>
      </Form>
      <Popup.Actions>
        <Popup.Confirm form="target-form" type="submit" isDisabled={isAcceptDisabled()} />
        <Popup.Cancel onClick={onCancel} />
      </Popup.Actions>
    </Popup>
  );
}
