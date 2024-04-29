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
import { Radio, Form, FormGroup } from "@patternfly/react-core";
import { sprintf } from "sprintf-js";

import { _ } from "~/i18n";
import { deviceChildren } from "~/components/storage/utils";
import { Popup } from "~/components/core";
import VolumeLocationSelectorTable from "~/components/storage/VolumeLocationSelectorTable";

/**
 * @typedef {"auto"|"device"|"reuse"} LocationOption
 * @typedef {import ("~/client/storage").StorageDevice} StorageDevice
 * @typedef {import ("~/client/storage").Volume} Volume
 * @typedef {import ("~/client/storage").VolumeTarget} VolumeTarget
 */

/** @type {(device: StorageDevice) => VolumeTarget} */
const defaultTarget = (device) => {
  if (["partition", "lvmLv", "md"].includes(device.type)) return "DEVICE";

  return "NEW_PARTITION";
};

/** @type {(volume: Volume, device: StorageDevice) => VolumeTarget[]} */
const availableTargets = (volume, device) => {
  /** @type {VolumeTarget[]} */
  const targets = ["DEVICE"];

  if (device.isDrive) {
    targets.push("NEW_PARTITION");
    targets.push("NEW_VG");
  }

  /** @fixme define type for possible fstypes */
  const fsTypes = volume.outline.fsTypes.map(f => f.toLowerCase());
  if (device.filesystem && fsTypes.includes(device.filesystem.type))
    targets.push("FILESYSTEM");

  return targets;
};

/** @type {(volume: Volume, device: StorageDevice) => VolumeTarget} */
const sanitizeTarget = (volume, device) => {
  const targets = availableTargets(volume, device);
  return targets.includes(volume.target) ? volume.target : defaultTarget(device);
};

/**
 * Renders a dialog that allows the user to change the location of a volume.
 * @component
 *
 * @typedef {object} VolumeLocationDialogProps
 * @property {Volume} volume
 * @property {Volume[]} volumes
 * @property {StorageDevice[]} volumeDevices
 * @property {StorageDevice[]} targetDevices
 * @property {boolean} [isOpen=false] - Whether the dialog is visible or not.
 * @property {() => void} onCancel
 * @property {(volume: Volume) => void} onAccept
 *
 * @param {VolumeLocationDialogProps} props
 */
export default function VolumeLocationDialog({
  volume,
  volumes,
  volumeDevices,
  targetDevices,
  isOpen,
  onCancel,
  onAccept,
  ...props
}) {
  const initialDevice = volume.targetDevice || targetDevices[0] || volumeDevices[0];
  const initialTarget = sanitizeTarget(volume, initialDevice);

  const [target, setTarget] = useState(initialTarget);
  const [targetDevice, setTargetDevice] = useState(initialDevice);

  const changeTargetDevice = (devices) => {
    const newTargetDevice = devices[0];

    if (newTargetDevice.name !== targetDevice.name) {
      setTarget(defaultTarget(newTargetDevice));
      setTargetDevice(newTargetDevice);
    }
  };

  const onSubmit = (e) => {
    e.preventDefault();
    const newVolume = { ...volume, target, targetDevice };
    onAccept(newVolume);
  };

  const isAcceptDisabled = () => {
    return false;
  };

  /** @type {(device: StorageDevice) => boolean} */
  const isDeviceSelectable = (device) => {
    return device.isDrive || ["md", "partition", "lvmLv"].includes(device.type);
  };

  const targets = availableTargets(volume, targetDevice);

  return (
    <Popup
      title={sprintf(_("Location for %s file system"), volume.mountPath)}
      description={_("Select in which device to allocate the file system.")}
      inlineSize="large"
      isOpen={isOpen}
      {...props}
    >
      <Form id="volume-location-form" onSubmit={onSubmit}>
        <div className="stack">
          <VolumeLocationSelectorTable
            aria-label={_("Select a device for placing the file system")}
            devices={volumeDevices}
            selectedDevices={[targetDevice]}
            targetDevices={targetDevices}
            volumes={volumes}
            itemChildren={deviceChildren}
            itemSelectable={isDeviceSelectable}
            onSelectionChange={changeTargetDevice}
            initialExpandedKeys={volumeDevices.map(d => d.sid)}
            variant="compact"
          />
          <FormGroup label={sprintf(_("Select how to allocate the %s file system"), volume.mountPath)}>
            <Radio
              id="new_partition"
              name="target"
              label={_("Create a new partition")}
              description={_("The new file system will be allocated as a new partition at the \
selected disk.")}
              isChecked={target === "NEW_PARTITION"}
              isDisabled={!targets.includes("NEW_PARTITION")}
              onChange={() => setTarget("NEW_PARTITION")}
            />
            <Radio
              id="dedicated_lvm"
              name="target"
              label={_("Create a dedicated LVM volume group")}
              description={_("A new volume group will be allocated in the selected disk and the \
file system will be created as a logical volume.")}
              isChecked={target === "NEW_VG"}
              isDisabled={!targets.includes("NEW_VG")}
              onChange={() => setTarget("NEW_VG")}
            />
            <Radio
              id="format"
              name="target"
              label={_("Format the device")}
              description={sprintf(_("The selected device will be formatted as %s file system and \
mounted at %s."), volume.fsType, volume.mountPath)}
              isChecked={target === "DEVICE"}
              isDisabled={!targets.includes("DEVICE")}
              onChange={() => setTarget("DEVICE")}
            />
            <Radio
              id="mount"
              name="target"
              label={_("Mount file system")}
              description={sprintf(_("The selected device will be mounted at %s."), volume.mountPath)}
              isChecked={target === "FILESYSTEM"}
              isDisabled={!targets.includes("FILESYSTEM")}
              onChange={() => setTarget("FILESYSTEM")}
            />
          </FormGroup>
        </div>
      </Form>
      <Popup.Actions>
        <Popup.Confirm form="volume-location-form" type="submit" isDisabled={isAcceptDisabled()} />
        <Popup.Cancel onClick={onCancel} />
      </Popup.Actions>
    </Popup>
  );
}
