/*
 * Copyright (c) [2023-2024] SUSE LLC
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

// @ts-check

import React from "react";
import { Label } from "@patternfly/react-core";
import { _ } from "~/i18n";
import { sprintf } from "sprintf-js";
import { deviceBaseName, deviceSize } from "~/components/storage/utils";
import { storage as system } from "~/api/system";
import { storage as proposal } from "~/api/proposal";
import { deviceSystems, isLogicalVolume, isMd, isPartition } from "~/helpers/storage/device";

type Device = system.Device | proposal.Device;
type UnusedSlot = system.UnusedSlot | proposal.UnusedSlot;

/**
 * Ensures the given item is a Device.
 */
const toDevice = (item: UnusedSlot | Device): Device | undefined => {
  if ("sid" in item) {
    return item;
  }
};

const toPartitionSlot = (item: UnusedSlot | Device): UnusedSlot | undefined => {
  if ("sid" in item) return undefined;
  return item;
};

/**
 * @component
 */
const FilesystemLabel = ({ item }: { item: UnusedSlot | Device }) => {
  const device = toDevice(item);
  if (!device) return null;

  const label = device.filesystem?.label;
  if (!label) return null;

  return (
    <Label isCompact>
      <b>{label}</b>
    </Label>
  );
};

/**
 * @component
 */
const DeviceName = ({ item }: { item: UnusedSlot | Device }) => {
  const device = toDevice(item);
  if (!device) return null;

  if (isPartition(device) || isLogicalVolume(device)) return deviceBaseName(device);

  return device.name;
};

/**
 * @component
 */
const DeviceDetails = ({ item }: { item: UnusedSlot | Device }) => {
  const device = toDevice(item);
  if (!device) return _("Unused space");

  const renderContent = (device: Device) => {
    const systems = deviceSystems(device);
    if (!device.partitionTable && systems.length > 0) return systems.join(", ");

    if (isMd(device)) {
      // TRANSLATORS: %1$s is a description of the device (eg. "Encrypted XFS RAID") and %2$s is
      // the RAID level (eg. "RAID0")
      return sprintf(_("%1$s (%2$s)"), device.description, device.md.level.toUpperCase());
    }

    return device.description;
  };

  const renderPTableType = (device: Device) => {
    const type = device.partitionTable?.type;
    if (type) return <Label isCompact>{type.toUpperCase()}</Label>;
  };

  return (
    <div>
      {renderContent(device)} <FilesystemLabel item={device} /> {renderPTableType(device)}
    </div>
  );
};

/**
 * @component
 */
const DeviceSize = ({ item }: { item: UnusedSlot | Device }) => {
  const partitionSlot = toPartitionSlot(item);
  const device = toDevice(item);
  return deviceSize(partitionSlot?.size || device?.block.size);
};

export { toDevice, toPartitionSlot, DeviceName, DeviceDetails, DeviceSize, FilesystemLabel };
