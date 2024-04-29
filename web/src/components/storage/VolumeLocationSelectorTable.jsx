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
import { Chip } from '@patternfly/react-core';

import { _ } from "~/i18n";
import {
  DeviceName, DeviceDetails, DeviceSize, toStorageDevice
} from "~/components/storage/device-utils";
import { ExpandableSelector } from "~/components/core";

/**
 * @typedef {import("../core/ExpandableSelector").ExpandableSelectorColumn} ExpandableSelectorColumn
 * @typedef {import("../core/ExpandableSelector").ExpandableSelectorProps} ExpandableSelectorProps
 * @typedef {import ("~/client/storage").StorageDevice} StorageDevice
 * @typedef {import ("~/client/storage").Volume} Volume
 */

const deviceUsers = (item, targetDevices, volumes) => {
  const device = toStorageDevice(item);
  if (!device) return [];

  const isTargetDevice = !!targetDevices.find(d => d.name === device.name);
  const volumeUsers = volumes.filter(v => v.targetDevice?.name === device.name);

  const users = [];
  if (isTargetDevice) users.push(_("Installation device"));

  return users.concat(volumeUsers.map(v => v.mountPath));
};

const DeviceUsage = ({ users }) => {
  return users.map((user, index) => <Chip key={index} isReadOnly>{user}</Chip>);
};

/**
 * Table for selecting the location for a volume.
 * @component
 *
 * @typedef {object} VolumeLocationSelectorTableBaseProps
 * @property {StorageDevice[]} devices
 * @property {StorageDevice[]} selectedDevices
 * @property {StorageDevice[]} targetDevices
 * @property {Volume[]} volumes
 *
 * @typedef {VolumeLocationSelectorTableBaseProps & ExpandableSelectorProps} VolumeLocationSelectorTable
 *
 * @param {VolumeLocationSelectorTable} props
 */
export default function VolumeLocationSelectorTable({
  devices,
  selectedDevices,
  targetDevices,
  volumes,
  ...props
}) {
  /** @type {ExpandableSelectorColumn[]} */
  const columns = [
    { name: _("Device"), value: (item) => <DeviceName item={item} /> },
    { name: _("Details"), value: (item) => <DeviceDetails item={item} /> },
    { name: _("Usage"), value: (item) => <DeviceUsage users={deviceUsers(item, targetDevices, volumes)} /> },
    { name: _("Size"), value: (item) => <DeviceSize item={item} />, classNames: "sizes-column" }
  ];

  return (
    <ExpandableSelector
      columns={columns}
      items={devices}
      itemIdKey="sid"
      itemClassNames={(device) => {
        if (!device.sid) {
          return "dimmed-row";
        }
      }}
      itemsSelected={selectedDevices}
      className="devices-table"
      {...props}
    />
  );
}
