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
import TruncatedDeviceName from "~/components/storage/TruncatedDeviceName";
import { useFlattenDevices } from "~/hooks/model/system/storage";
import { deviceBaseName, deviceSize } from "~/components/storage/utils";
import { sortCollection } from "~/utils";
import { _ } from "~/i18n";

import type { Storage } from "~/model/system";
import type { SelectableDataTableProps, SortedBy } from "~/components/core/SelectableDataTable";

/** Props for {@link VolumeGroupsTable}. */
type VolumeGroupsTableProps = {
  /** Available LVM volume groups. */
  devices: Storage.Device[];
  /** Currently selected volume groups. */
  selectedDevices?: Storage.Device[];
  /** Called when the selection changes. */
  onSelectionChange: SelectableDataTableProps<Storage.Device>["onSelectionChange"];
  /** Selection mode. Defaults to `"single"`. */
  selectionMode?: SelectableDataTableProps<Storage.Device>["selectionMode"];
};

const logicalVolumeNames = (device: Storage.Device): string =>
  device.logicalVolumes.map((lv) => deviceBaseName(lv)).join(", ");

const physicalVolumeNames = (device: Storage.Device, systemDevices: Storage.Device[]): string =>
  device.volumeGroup.physicalVolumes
    .map((sid) => {
      const pv = systemDevices.find((d) => d.sid === sid);
      return pv ? deviceBaseName(pv) : sid;
    })
    .join(", ");

/**
 * Table for selecting among available LVM volume groups.
 *
 * Displays device name, size, logical volume names, and physical volume names.
 */
export default function VolumeGroupsTable({
  devices,
  selectedDevices,
  onSelectionChange,
  selectionMode = "single",
}: VolumeGroupsTableProps) {
  const [sortedBy, setSortedBy] = useState<SortedBy>({ index: 0, direction: "asc" });
  const systemDevices = useFlattenDevices();

  const columns = [
    {
      name: _("Device"),
      value: (device: Storage.Device) => <TruncatedDeviceName device={device} />,
      sortingKey: "name",
      pfTdProps: { style: { width: "15ch" } },
    },
    {
      name: _("Size"),
      value: (device: Storage.Device) => deviceSize(device.volumeGroup?.size ?? 0),
      sortingKey: (d: Storage.Device) => d.volumeGroup?.size ?? 0,
      pfTdProps: { style: { width: "10ch" } },
    },
    {
      name: _("Logical volumes"),
      value: logicalVolumeNames,
    },
    {
      name: _("Physical volumes"),
      value: (device: Storage.Device) => physicalVolumeNames(device, systemDevices),
    },
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
