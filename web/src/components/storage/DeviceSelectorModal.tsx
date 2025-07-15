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
import { SelectableDataTable, Popup } from "~/components/core/";
import { StorageDevice } from "~/types/storage";
import { SelectableDataTableProps } from "../core/SelectableDataTable";
import {
  typeDescription,
  contentDescription,
  filesystemLabels,
} from "~/components/storage/utils/device";
import { deviceSize } from "~/components/storage/utils";
import { _ } from "~/i18n";
import { PopupProps } from "../core/Popup";
import { ButtonProps, Flex, Label } from "@patternfly/react-core";

type DeviceSelectorProps = {
  devices: StorageDevice[];
  selectedDevices?: StorageDevice[];
  onSelectionChange: SelectableDataTableProps<StorageDevice>["onSelectionChange"];
  selectionMode?: SelectableDataTableProps<StorageDevice>["selectionMode"];
};

const size = (device: StorageDevice) => {
  return deviceSize(device.size);
};

const description = (device: StorageDevice) => {
  if (device.model && device.model.length) return device.model;

  return typeDescription(device);
};

const details = (device: StorageDevice) => {
  return (
    <Flex columnGap={{ default: "columnGapXs" }}>
      {contentDescription(device)}
      {device.systems.map((s, i) => (
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
  return (
    <>
      <SelectableDataTable
        columns={[
          { name: _("Device"), value: (device: StorageDevice) => device.name },
          { name: _("Size"), value: size, pfTdProps: { style: { width: "10ch" } } },
          { name: _("Description"), value: description },
          { name: _("Current content"), value: details },
        ]}
        items={devices}
        itemIdKey="sid"
        itemsSelected={selectedDevices}
        onSelectionChange={onSelectionChange}
        selectionMode={selectionMode}
      />
    </>
  );
};

type DeviceSelectorModalProps = Omit<PopupProps, "children" | "selected"> & {
  selected?: StorageDevice;
  devices: StorageDevice[];
  onConfirm: (selection: StorageDevice[]) => void;
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
  const [selectedDevices, setSelectedDevices] = useState<StorageDevice[]>(
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
