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

import React from "react";
import { Chip, Split } from "@patternfly/react-core";
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
        <Chip key={index} isReadOnly>
          {user}
        </Chip>
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
    { name: _("Device"), value: (item) => <DeviceName item={item} /> },
    { name: _("Details"), value: (item) => <DeviceDetails item={item} /> },
    {
      name: _("Usage"),
      value: (item) => <DeviceUsage users={deviceUsers(item, targetDevices, volumes)} />,
    },
    { name: _("Size"), value: (item) => <DeviceSize item={item} />, classNames: "sizes-column" },
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
