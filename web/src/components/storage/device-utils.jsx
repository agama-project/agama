/*
 * Copyright (c) [2023-2024] SUSE LLC
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

import { _ } from "~/i18n";
import { Tag } from "~/components/core";
import { deviceBaseName, deviceSize } from "~/components/storage/utils";

/**
 * @typedef {import ("~/client/storage").PartitionSlot} PartitionSlot
 * @typedef {import ("~/client/storage").StorageDevice} StorageDevice
 */

/**
 * Conversion to StorageDevice.
 * @function
 *
 * @param {PartitionSlot|StorageDevice} item
 * @returns {StorageDevice|undefined}
 */
const toStorageDevice = (item) => {
  const { sid } = /** @type {object} */ (item);
  if (!sid) return undefined;

  return /** @type {StorageDevice} */ (item);
};

/**
 * @component
 *
 * @param {object} props
 * @param {PartitionSlot|StorageDevice} props.item
 */
const FilesystemLabel = ({ item }) => {
  const device = toStorageDevice(item);
  if (!device) return null;

  const label = device.filesystem?.label;
  if (label) return <Tag variant="gray-highlight"><b>{label}</b></Tag>;
};

/**
 * @component
 *
 * @param {object} props
 * @param {PartitionSlot|StorageDevice} props.item
 */
const DeviceName = ({ item }) => {
  const device = toStorageDevice(item);
  if (!device) return null;

  if (["partition", "lvmLv"].includes(device.type)) return deviceBaseName(device);

  return device.name;
};

/**
 * @component
 *
 * @param {object} props
 * @param {PartitionSlot|StorageDevice} props.item
 */
const DeviceDetails = ({ item }) => {
  const device = toStorageDevice(item);
  if (!device) return _("Unused space");

  const renderContent = (device) => {
    if (!device.partitionTable && device.systems?.length > 0)
      return device.systems.join(", ");

    return device.description;
  };

  const renderPTableType = (device) => {
    const type = device.partitionTable?.type;
    if (type) return <Tag><b>{type.toUpperCase()}</b></Tag>;
  };

  return (
    <div>{renderContent(device)} <FilesystemLabel item={device} /> {renderPTableType(device)}</div>
  );
};

/**
 * @component
 *
 * @param {object} props
 * @param {PartitionSlot|StorageDevice} props.item
 */
const DeviceSize = ({ item }) => {
  return deviceSize(item.size);
};

export { toStorageDevice, DeviceName, DeviceDetails, DeviceSize, FilesystemLabel };
