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
import { deviceSize } from "~/components/storage/utils";
import { typeDescription } from "~/components/storage/utils/device";
import { sortCollection } from "~/utils";
import { _ } from "~/i18n";

import type { Storage } from "~/model/system";
import type { SortedBy, SelectableDataTableProps } from "~/components/core/SelectableDataTable";

/** Props for {@link DrivesTable}. */
type DrivesTableProps = {
  /** Available drives. */
  devices: Storage.Device[];
  /** Currently selected drives. */
  selectedDevices?: Storage.Device[];
  /** Called when the selection changes. */
  onSelectionChange: SelectableDataTableProps<Storage.Device>["onSelectionChange"];
  /** Selection mode. Defaults to `"single"`. */
  selectionMode?: SelectableDataTableProps<Storage.Device>["selectionMode"];
};

const size = (device: Storage.Device) => {
  const bytes = device.volumeGroup?.size || device.block?.size || 0;
  return deviceSize(bytes);
};

const description = (device: Storage.Device) => {
  const model = device.drive?.model;
  if (model && model.length) return model;

  return typeDescription(device);
};

/**
 * Table for selecting among available drives.
 */
export default function DrivesTable({
  devices,
  selectedDevices,
  onSelectionChange,
  selectionMode = "single",
}: DrivesTableProps) {
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
      value: size,
      sortingKey: (d: Storage.Device) => d.block.size,
      pfTdProps: { style: { width: "10ch" } },
    },
    { name: _("Description"), value: description },
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
