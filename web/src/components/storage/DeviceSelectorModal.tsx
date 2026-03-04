/*
 * Copyright (c) [2025] SUSE LLC
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
import { ButtonProps, Flex, Label } from "@patternfly/react-core";
import Popup, { PopupProps } from "~/components/core/Popup";
import SelectableDataTable, {
  SortedBy,
  SelectableDataTableProps,
} from "~/components/core/SelectableDataTable";
import {
  typeDescription,
  contentDescription,
  filesystemLabels,
} from "~/components/storage/utils/device";
import { deviceSize } from "~/components/storage/utils";
import { sortCollection } from "~/utils";
import { _ } from "~/i18n";
import { deviceSystems } from "~/model/storage/device";
import type { Storage } from "~/model/system";

type DeviceSelectorProps = {
  devices: Storage.Device[];
  selectedDevices?: Storage.Device[];
  onSelectionChange: SelectableDataTableProps<Storage.Device>["onSelectionChange"];
  selectionMode?: SelectableDataTableProps<Storage.Device>["selectionMode"];
};

const size = (device: Storage.Device) => {
  return deviceSize(device.block.size);
};

const description = (device: Storage.Device) => {
  const model = device.drive?.model;
  if (model && model.length) return model;

  return typeDescription(device);
};

const details = (device: Storage.Device) => {
  return (
    <Flex columnGap={{ default: "columnGapXs" }}>
      {contentDescription(device)}
      {deviceSystems(device).map((s, i) => (
        <Label key={`system-${i}`} isCompact>
          {s}
        </Label>
      ))}
      {filesystemLabels(device).map((s, i) => (
        <Label key={`label-${i}`} variant="outline" isCompact>
          {s}
        </Label>
      ))}
    </Flex>
  );
};

// TODO: document
const DeviceSelector = ({
  devices,
  selectedDevices,
  onSelectionChange,
  selectionMode = "single",
}: DeviceSelectorProps) => {
  const [sortedBy, setSortedBy] = useState<SortedBy>({ index: 0, direction: "asc" });

  const columns = [
    { name: _("Device"), value: (device: Storage.Device) => device.name, sortingKey: "name" },
    {
      name: _("Size"),
      value: size,
      sortingKey: (d: Storage.Device) => d.block.size,
      pfTdProps: { style: { width: "10ch" } },
    },
    { name: _("Description"), value: description },
    { name: _("Current content"), value: details },
  ];

  // Sorting
  const sortingKey = columns[sortedBy.index].sortingKey;
  const sortedDevices = sortCollection(devices, sortedBy.direction, sortingKey);

  return (
    <>
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
    </>
  );
};

type DeviceSelectorModalProps = Omit<PopupProps, "children" | "selected"> & {
  selected?: Storage.Device;
  devices: Storage.Device[];
  onConfirm: (selection: Storage.Device[]) => void;
  onCancel: ButtonProps["onClick"];
};

export default function DeviceSelectorModal({
  selected = undefined,
  onConfirm,
  onCancel,
  devices,
  ...popupProps
}: DeviceSelectorModalProps): React.ReactNode {
  // FIXME: improve initial selection handling
  const [selectedDevices, setSelectedDevices] = useState<Storage.Device[]>(
    selected ? [selected] : [devices[0]],
  );

  const onAccept = () => {
    selectedDevices !== Array(selected) && onConfirm(selectedDevices);
  };

  return (
    <Popup isOpen variant="medium" {...popupProps}>
      <DeviceSelector
        devices={devices}
        selectedDevices={selectedDevices}
        onSelectionChange={setSelectedDevices}
      />
      <Popup.Actions>
        <Popup.Confirm onClick={onAccept} />
        <Popup.Cancel onClick={onCancel} />
      </Popup.Actions>
    </Popup>
  );
}
