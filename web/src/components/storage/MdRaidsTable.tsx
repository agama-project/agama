/*
 * Copyright (c) [2026] SUSE LLC
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
import SelectableDataTable from "~/components/core/SelectableDataTable";
import DeviceContent from "~/components/storage/DeviceContent";
import TruncatedDeviceName from "~/components/storage/TruncatedDeviceName";
import { useFlattenDevices } from "~/hooks/model/system/storage";
import { deviceBaseName, deviceSize } from "~/components/storage/utils";
import { sortCollection } from "~/utils";
import { _ } from "~/i18n";

import type { Storage } from "~/model/system";
import type { SelectableDataTableProps, SortedBy } from "~/components/core/SelectableDataTable";

/** Props for {@link MdRaidsTable}. */
type MdRaidsTableProps = {
  /** Available software RAID devices. */
  devices: Storage.Device[];
  /** Currently selected devices. */
  selectedDevices?: Storage.Device[];
  /** Called when the selection changes. */
  onSelectionChange: SelectableDataTableProps<Storage.Device>["onSelectionChange"];
  /** Selection mode. Defaults to `"single"`. */
  selectionMode?: SelectableDataTableProps<Storage.Device>["selectionMode"];
};

const level = (device: Storage.Device): string => device.md.level.toUpperCase();

const memberNames = (device: Storage.Device, systemDevices: Storage.Device[]): string =>
  device.md.devices
    .map((sid) => {
      const pv = systemDevices.find((d) => d.sid === sid);
      return pv ? deviceBaseName(pv) : sid;
    })
    .join(", ");

/**
 * Table for selecting among available software RAID devices.
 */
export default function MdRaidsTable({
  devices,
  selectedDevices,
  onSelectionChange,
  selectionMode = "single",
}: MdRaidsTableProps) {
  const systemDevices = useFlattenDevices();
  const [sortedBy, setSortedBy] = useState<SortedBy>({ index: 0, direction: "asc" });

  const columns = [
    {
      name: _("Device"),
      value: (device: Storage.Device) => <TruncatedDeviceName device={device} maxLength={13} />,
      sortingKey: "name",
      pfTdProps: { style: { width: "15ch" } },
    },
    {
      name: _("Size"),
      value: (device: Storage.Device) => deviceSize(device.block.size),
      sortingKey: (d: Storage.Device) => d.block.size,
      pfTdProps: { style: { width: "10ch" } },
    },
    { name: _("Level"), value: level, sortingKey: level },
    {
      name: _("Members"),
      value: (device: Storage.Device) => memberNames(device, systemDevices),
    },
    { name: _("Current content"), value: (d: Storage.Device) => <DeviceContent device={d} /> },
  ];

  const sortingKey = columns[sortedBy.index].sortingKey;
  const sortedDevices = sortCollection(devices, sortedBy.direction, sortingKey);

  return (
    <SelectableDataTable
      columns={columns}
      items={sortedDevices}
      itemIdKey="sid"
      itemsSelected={selectedDevices}
      onSelectionChange={onSelectionChange}
      selectionMode={selectionMode}
      sortedBy={sortedBy}
      updateSorting={setSortedBy}
    />
  );
}
