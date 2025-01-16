/*
 * Copyright (c) [2024-2025] SUSE LLC
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

import React from "react";
import { Content, Split } from "@patternfly/react-core";
import { _ } from "~/i18n";
import {
  DeviceName,
  DeviceDetails,
  DeviceSize,
  toStorageDevice,
} from "~/components/storage/device-utils";
import { ExpandableSelector } from "~/components/core";
import {
  ExpandableSelectorColumn,
  ExpandableSelectorProps,
} from "~/components/core/ExpandableSelector";
import { PartitionSlot, StorageDevice, Volume } from "~/types/storage";
import { DeviceInfo } from "~/api/storage/types";

/**
 * Returns what (volumes, installation device) is using a device.
 */
const deviceUsers = (
  item: PartitionSlot | StorageDevice,
  targetDevices: StorageDevice[],
  volumes: Volume[],
): string[] => {
  const device = toStorageDevice(item);
  if (!device) return [];

  const isTargetDevice = !!targetDevices.find((d) => d.name === device.name);
  const volumeUsers = volumes.filter((v) => v.targetDevice?.name === device.name);

  const users = [];
  if (isTargetDevice) users.push(_("Installation device"));

  return users.concat(volumeUsers.map((v) => v.mountPath));
};

/**
 * @component
 */
const DeviceUsage = ({ users }: { users: string[] }) => {
  return (
    <Split hasGutter isWrappable>
      {users.map((user, index) => (
        <Content key={index}>{user}</Content>
      ))}
    </Split>
  );
};

type VolumeLocationSelectorTableBaseProps = {
  devices: StorageDevice[];
  selectedDevices: StorageDevice[];
  targetDevices: StorageDevice[];
  volumes: Volume[];
};

export type VolumeLocationSelectorTableProps = VolumeLocationSelectorTableBaseProps &
  ExpandableSelectorProps;

/**
 * Table for selecting the location for a volume.
 * @component
 */
export default function VolumeLocationSelectorTable({
  devices,
  selectedDevices,
  targetDevices,
  volumes,
  ...props
}: VolumeLocationSelectorTableProps) {
  const columns: ExpandableSelectorColumn[] = [
    {
      name: _("Device"),
      value: (item: PartitionSlot | StorageDevice) => <DeviceName item={item} />,
    },
    {
      name: _("Details"),
      value: (item: PartitionSlot | StorageDevice) => <DeviceDetails item={item} />,
    },
    {
      name: _("Usage"),
      value: (item: PartitionSlot | StorageDevice) => (
        <DeviceUsage users={deviceUsers(item, targetDevices, volumes)} />
      ),
    },
    {
      name: _("Size"),
      value: (item: PartitionSlot | StorageDevice) => <DeviceSize item={item} />,
      classNames: "sizes-column",
    },
  ];

  return (
    <ExpandableSelector
      columns={columns}
      items={devices}
      itemIdKey="sid"
      itemClassNames={(device: DeviceInfo) => {
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
