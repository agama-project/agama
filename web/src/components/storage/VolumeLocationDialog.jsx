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
import { Checkbox, Form } from "@patternfly/react-core";
import { _ } from "~/i18n";
import { DevicesFormSelect } from "~/components/storage";
import { Popup, RadioField } from "~/components/core";
import { deviceLabel } from "~/components/storage/utils";
import { sprintf } from "sprintf-js";

/**
 * @typedef {"auto"|"device"|"reuse"} LocationOption
 * @typedef {import ("~/client/storage").ProposalTarget} ProposalTarget
 * @typedef {import ("~/client/storage").StorageDevice} StorageDevice
 * @typedef {import ("~/client/storage").Volume} Volume
 * @typedef {import ("~/client/storage").VolumeTarget} VolumeTarget
 */

/**
 * Generates a location option value from the given target.
 * @function
 *
 * @param {VolumeTarget} target
 * @returns {LocationOption}
 */
const targetToOption = (target) => {
  switch (target) {
    case "DEFAULT":
      return "auto";
    case "NEW_PARTITION":
    case "NEW_VG":
      return "device";
    case "DEVICE":
    case "FILESYSTEM":
      return "reuse";
  }
};

/**
 * Renders a dialog that allows the user to change the location of a volume.
 * @component
 *
 * @typedef {object} VolumeLocationDialogProps
 * @property {Volume} volume - Volume to edit.
 * @property {StorageDevice[]} devices - Devices available for installation.
 * @property {ProposalTarget} target - Installation target.
 * @property {StorageDevice|undefined} targetDevice - Device selected for installation, if target is a disk.
 * @property {boolean} [isOpen=false] - Whether the dialog is visible or not.
 * @property {() => void} onCancel
 * @property {(volume: Volume) => void} onAccept
 *
 * @param {VolumeLocationDialogProps} props
 */
export default function VolumeLocationDialog({
  volume,
  devices,
  target,
  targetDevice: defaultTargetDevice,
  isOpen,
  onCancel,
  onAccept,
  ...props
}) {
  const [locationOption, setLocationOption] = useState(targetToOption(volume.target));
  const [targetDevice, setTargetDevice] = useState(volume.targetDevice || defaultTargetDevice || devices[0]);
  const [isDedicatedVG, setIsDedicatedVG] = useState(volume.target === "NEW_VG");

  const selectAutoOption = () => setLocationOption("auto");
  const selectDeviceOption = () => setLocationOption("device");
  const toggleDedicatedVG = (_, value) => setIsDedicatedVG(value);

  const isLocationAuto = locationOption === "auto";
  const isLocationDevice = locationOption === "device";

  const onSubmit = (e) => {
    e.preventDefault();
    const newVolume = { ...volume };

    if (isLocationAuto) {
      newVolume.target = "DEFAULT";
      newVolume.targetDevice = undefined;
    }

    if (isLocationDevice) {
      newVolume.target = isDedicatedVG ? "NEW_VG" : "NEW_PARTITION";
      newVolume.targetDevice = targetDevice;
    }

    onAccept(newVolume);
  };

  const isAcceptDisabled = () => {
    return isLocationDevice && targetDevice === undefined;
  };

  const autoText = () => {
    if (target === "DISK" && defaultTargetDevice)
      // TRANSLATORS: %s is replaced by a device label (e.g., "/dev/vda, 50 GiB").
      return sprintf(_("The filesystem will be allocated as a new partition at the installation \
disk (%s)."), deviceLabel(defaultTargetDevice));

    if (target === "DISK")
      return _("The filesystem will be allocated as a new partition at the installation disk.");

    return _("The file system will be allocated as a logical volume at the system LVM.");
  };

  return (
    <Popup
      title={sprintf(_("Location for %s file system"), volume.mountPath)}
      isOpen={isOpen}
      {...props}
    >
      <Form id="volume-location-form" onSubmit={onSubmit}>
        <RadioField
          label={_("Automatic")}
          description={autoText()}
          iconSize="xs"
          textWrapper="span"
          isChecked={isLocationAuto}
          onClick={selectAutoOption}
        />

        <RadioField
          label={_("Select a disk")}
          description={_("The file system will be allocated as a new partition at the selected disk.")}
          iconSize="xs"
          textWrapper="span"
          isChecked={isLocationDevice}
          onClick={selectDeviceOption}
        >
          <div className="stack">
            <DevicesFormSelect
              aria-label={_("Choose a disk for placing the file system")}
              devices={devices}
              selectedDevice={targetDevice}
              onChange={setTargetDevice}
              isDisabled={!isLocationDevice}
            />
            <Checkbox
              id="dedicated_lvm"
              label={_("Create a dedicated LVM volume group")}
              description={_("A new volume group will be allocated in the selected disk and the \
  file system will be created as a logical volume.")}
              isChecked={isDedicatedVG}
              onChange={toggleDedicatedVG}
              isDisabled={!isLocationDevice}
            />
          </div>
        </RadioField>
      </Form>
      <Popup.Actions>
        <Popup.Confirm form="volume-location-form" type="submit" isDisabled={isAcceptDisabled()} />
        <Popup.Cancel onClick={onCancel} />
      </Popup.Actions>
    </Popup>
  );
}
