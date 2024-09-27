/*
 * Copyright (c) [2024] SUSE LLC
 *
 * All Rights Reserved.
 *
 * This program is free software; you can redistribute it and/or modify it
 * under the terms of the GNU General Public License as published by the Free
 * Software Foundation; either version 2 of the License, or (at your option)
 * any later version.
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
import { Form, FormGroup, Radio, Stack } from "@patternfly/react-core";
import { FormReadOnlyField, Popup } from "~/components/core";
import VolumeLocationSelectorTable from "~/components/storage/VolumeLocationSelectorTable";
import { _ } from "~/i18n";
import { sprintf } from "sprintf-js";
import { deviceChildren, volumeLabel } from "~/components/storage/utils";
import { StorageDevice, Volume, VolumeTarget } from "~/types/storage";

const defaultTarget: (device: StorageDevice | undefined) => VolumeTarget = (
  device,
): VolumeTarget => {
  if (["partition", "lvmLv", "md"].includes(device?.type)) return VolumeTarget.DEVICE;

  return VolumeTarget.NEW_PARTITION;
};

/** @type {(volume: Volume, device: StorageDevice|undefined) => VolumeTarget[]} */
const availableTargets: (volume: Volume, device: StorageDevice | undefined) => VolumeTarget[] = (
  volume,
  device,
): VolumeTarget[] => {
  /** @type {VolumeTarget[]} */
  const targets: VolumeTarget[] = [VolumeTarget.DEVICE];

  if (device?.isDrive) {
    targets.push(VolumeTarget.NEW_PARTITION);
    targets.push(VolumeTarget.NEW_VG);
  }

  if (device?.filesystem && volume.outline.fsTypes.includes(device.filesystem.type))
    targets.push(VolumeTarget.FILESYSTEM);

  return targets;
};

/** @type {(volume: Volume, device: StorageDevice|undefined) => VolumeTarget} */
const sanitizeTarget: (volume: Volume, device: StorageDevice | undefined) => VolumeTarget = (
  volume,
  device,
): VolumeTarget => {
  const targets = availableTargets(volume, device);
  return targets.includes(volume.target) ? volume.target : defaultTarget(device);
};

export type VolumeLocationDialogProps = {
  volume: Volume;
  volumes: Volume[];
  volumeDevices: StorageDevice[];
  targetDevices: StorageDevice[];
  isOpen?: boolean;
  onCancel: () => void;
  onAccept: (volume: Volume) => void;
};

/**
 * Renders a dialog that allows the user to change the location of a volume.
 * @component
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
}: VolumeLocationDialogProps) {
  /** @type {StorageDevice|undefined} */
  const initialDevice: StorageDevice | undefined =
    volume.targetDevice || targetDevices[0] || volumeDevices[0];
  /** @type {VolumeTarget} */
  const initialTarget: VolumeTarget = sanitizeTarget(volume, initialDevice);

  const [target, setTarget] = useState(initialTarget);
  const [targetDevice, setTargetDevice] = useState(initialDevice);

  /** @type {(devices: StorageDevice[]) => void} */
  const changeTargetDevice: (devices: StorageDevice[]) => void = (devices): void => {
    const newTargetDevice = devices[0];

    if (newTargetDevice.name !== targetDevice.name) {
      setTarget(defaultTarget(newTargetDevice));
      setTargetDevice(newTargetDevice);
    }
  };

  /** @type {(e: import("react").FormEvent) => void} */
  const onSubmit: (e: import("react").FormEvent) => void = (e): void => {
    e.preventDefault();
    const newVolume = { ...volume, target, targetDevice };
    onAccept(newVolume);
  };

  /** @type {(device: StorageDevice) => boolean} */
  const isDeviceSelectable: (device: StorageDevice) => boolean = (device): boolean => {
    return device.isDrive || ["md", "partition", "lvmLv"].includes(device.type);
  };

  const targets = availableTargets(volume, targetDevice);

  if (!targetDevice) return null;

  // TRANSLATORS: Description of the dialog for changing the location of a file system.
  const dialogDescription = _(
    "The file systems are allocated at the installation device by \
default. Indicate a custom location to create the file system at a specific device.",
  );

  return (
    <Popup
      // TRANSLATORS: Title of the dialog for changing the location of a file system. %s is replaced
      // by a mount path (e.g., /home).
      title={sprintf(_("Location for %s file system"), volumeLabel(volume))}
      description={dialogDescription}
      inlineSize="large"
      blockSize="large"
      isOpen={isOpen}
      className="location-layout"
      {...props}
    >
      <Form id="volume-location-form" onSubmit={onSubmit}>
        {/** FIXME: Rename FormReadOnlyField */}
        <FormReadOnlyField label={_("Select in which device to allocate the file system")} />
        <div className="scrollbox">
          <VolumeLocationSelectorTable
            aria-label={_("Select a location")}
            devices={volumeDevices}
            selectedDevices={[targetDevice]}
            targetDevices={targetDevices}
            volumes={volumes}
            itemChildren={deviceChildren}
            itemSelectable={isDeviceSelectable}
            onSelectionChange={changeTargetDevice}
            initialExpandedKeys={volumeDevices.map((d) => d.sid)}
            variant="compact"
          />
        </div>
        <FormGroup label={_("Select how to allocate the file system")}>
          <Stack hasGutter>
            <Radio
              id="new_partition"
              name="target"
              label={_("Create a new partition")}
              description={_(
                "The file system will be allocated as a new partition at the selected \
  disk.",
              )}
              isChecked={target === VolumeTarget.NEW_PARTITION}
              isDisabled={!targets.includes(VolumeTarget.NEW_PARTITION)}
              onChange={() => setTarget(VolumeTarget.NEW_PARTITION)}
            />
            <Radio
              id="dedicated_lvm"
              name="target"
              label={_("Create a dedicated LVM volume group")}
              description={_(
                "A new volume group will be allocated in the selected disk and the \
  file system will be created as a logical volume.",
              )}
              isChecked={target === VolumeTarget.NEW_VG}
              isDisabled={!targets.includes(VolumeTarget.NEW_VG)}
              onChange={() => setTarget(VolumeTarget.NEW_VG)}
            />
            <Radio
              id="format"
              name="target"
              label={_("Format the device")}
              description={
                // TRANSLATORS: %s is replaced by a file system type (e.g., Ext4).
                sprintf(
                  _("The selected device will be formatted as %s file system."),
                  volume.fsType,
                )
              }
              isChecked={target === VolumeTarget.DEVICE}
              isDisabled={!targets.includes(VolumeTarget.DEVICE)}
              onChange={() => setTarget(VolumeTarget.DEVICE)}
            />
            <Radio
              id="mount"
              name="target"
              label={_("Mount the file system")}
              description={_(
                "The current file system on the selected device will be mounted \
  without formatting the device.",
              )}
              isChecked={target === VolumeTarget.FILESYSTEM}
              isDisabled={!targets.includes(VolumeTarget.FILESYSTEM)}
              onChange={() => setTarget(VolumeTarget.FILESYSTEM)}
            />
          </Stack>
        </FormGroup>
      </Form>
      <Popup.Actions>
        <Popup.Confirm form="volume-location-form" type="submit" />
        <Popup.Cancel onClick={onCancel} />
      </Popup.Actions>
    </Popup>
  );
}
