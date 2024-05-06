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
import { FormSelect, FormSelectOption } from "@patternfly/react-core";
import { sprintf } from "sprintf-js";

import { _ } from "~/i18n";
import { deviceChildren, deviceSize } from '~/components/storage/utils';
import {
  DeviceName, DeviceDetails, DeviceSize, toStorageDevice
} from "~/components/storage/device-utils";
import { TreeTable } from "~/components/core";

/**
 * @typedef {import("~/client/storage").PartitionSlot} PartitionSlot
 * @typedef {import ("~/client/storage").SpaceAction} SpaceAction
 * @typedef {import ("~/client/storage").StorageDevice} StorageDevice
 * @typedef {import("../core/TreeTable").TreeTableColumn} TreeTableColumn
 */

/**
 * @component
 *
 * @param {object} props
 * @param {PartitionSlot|StorageDevice} props.item
 */
const DeviceSizeDetails = ({ item }) => {
  const device = toStorageDevice(item);
  if (!device || device.isDrive || device.recoverableSize === 0) return null;

  return deviceSize(device.recoverableSize);
};

/**
 * Form to configure the space action for a device (a partition).
 * @component
 *
 * @param {object} props
 * @param {StorageDevice} props.device
 * @param {string} props.action - Possible values: "force_delete", "resize" or "keep".
 * @param {boolean} [props.isDisabled=false]
 * @param {(action: SpaceAction) => void} [props.onChange]
 */
const DeviceActionForm = ({ device, action, isDisabled = false, onChange }) => {
  const changeAction = (_, action) => onChange({ device: device.name, action });

  return (
    <FormSelect
      value={action}
      isDisabled={isDisabled}
      onChange={changeAction}
      aria-label={
        /* TRANSLATORS: %s is replaced by a device name (e.g., /dev/sda) */
        sprintf(_("Space action selector for %s"), device.name)
      }
    >
      <FormSelectOption value="force_delete" label={_("Delete")} />
      <FormSelectOption value="resize" label={_("Allow resize")} />
      <FormSelectOption value="keep" label={_("Do not modify")} />
    </FormSelect>
  );
};

/**
 * Column content with the space action (a form or a description) for a device
 * @component
 *
 * @param {object} props
 * @param {PartitionSlot|StorageDevice} props.item
 * @param {string} props.action - Possible values: "force_delete", "resize" or "keep".
 * @param {boolean} [props.isDisabled=false]
 * @param {(action: SpaceAction) => void} [props.onChange]
 */
const DeviceAction = ({ item, action, isDisabled = false, onChange }) => {
  const device = toStorageDevice(item);
  if (!device) return null;

  if (device.type === "partition") {
    return (
      <DeviceActionForm
        device={device}
        action={action}
        isDisabled={isDisabled}
        onChange={onChange}
      />
    );
  }

  if (device.filesystem || device.component)
    return _("The content may be deleted");

  if (!device.partitionTable || device.partitionTable.partitions.length === 0)
    return _("No content found");

  return null;
};

/**
 * Table for selecting the space actions of the given devices.
 * @component
 *
 * @typedef {object} SpaceActionsTableProps
 * @property {StorageDevice[]} devices
 * @property {StorageDevice[]} [expandedDevices=[]] - Initially expanded devices.
 * @property {boolean} [isActionDisabled=false] - Whether the action selector is disabled.
 * @property {(item: PartitionSlot|StorageDevice) => string} deviceAction - Gets the action for a device.
 * @property {(action: SpaceAction) => void} onActionChange
 *
 * @param {SpaceActionsTableProps} props
 */
export default function SpaceActionsTable({
  devices,
  expandedDevices = [],
  isActionDisabled = false,
  deviceAction,
  onActionChange,
}) {
  /** @type {TreeTableColumn[]} */
  const columns = [
    { name: _("Device"), value: (item) => <DeviceName item={item} /> },
    { name: _("Details"), value: (item) => <DeviceDetails item={item} /> },
    { name: _("Size"), value: (item) => <DeviceSize item={item} /> },
    { name: _("Shrinkable"), value: (item) => <DeviceSizeDetails item={item} /> },
    {
      name: _("Action"),
      value: (item) => (
        <DeviceAction
          item={item}
          action={deviceAction(item)}
          isDisabled={isActionDisabled}
          onChange={onActionChange}
        />
      )
    }
  ];

  return (
    <TreeTable
      columns={columns}
      items={devices}
      aria-label={_("Actions to find space")}
      expandedItems={expandedDevices}
      itemChildren={deviceChildren}
      rowClassNames={(item) => {
        if (!item.sid) return "dimmed-row";
      }}
      className="devices-table"
    />
  );
}
