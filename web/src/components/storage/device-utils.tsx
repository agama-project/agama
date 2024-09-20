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
import { deviceBaseName, deviceSize } from "~/components/storage/utils";
import { PartitionSlot, StorageDevice } from "~/types/storage";

/**
 * Ensures the given item is a StorageDevice.
 */
const toStorageDevice = (item: PartitionSlot | StorageDevice): StorageDevice | undefined => {
  if ("sid" in item) {
    return item;
  }
};

/**
 * @component
 */
const FilesystemLabel = ({ item }: { item: PartitionSlot | StorageDevice }) => {
  const device = toStorageDevice(item);
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
const DeviceName = ({ item }: { item: PartitionSlot | StorageDevice }) => {
  const device = toStorageDevice(item);
  if (!device) return null;

  if (["partition", "lvmLv"].includes(device.type)) return deviceBaseName(device);

  return device.name;
};

/**
 * @component
 */
const DeviceDetails = ({ item }: { item: PartitionSlot | StorageDevice }) => {
  const device = toStorageDevice(item);
  if (!device) return _("Unused space");

  const renderContent = (device: StorageDevice) => {
    if (!device.partitionTable && device.systems?.length > 0) return device.systems.join(", ");

    return device.description;
  };

  const renderPTableType = (device: StorageDevice) => {
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
const DeviceSize = ({ item }: { item: PartitionSlot | StorageDevice }) => {
  return deviceSize(item.size);
};

export { toStorageDevice, DeviceName, DeviceDetails, DeviceSize, FilesystemLabel };
