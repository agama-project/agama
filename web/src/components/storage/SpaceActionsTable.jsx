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
import {
  Button,
  Flex, FlexItem,
  List, ListItem,
  Popover,
  ToggleGroup, ToggleGroupItem
} from "@patternfly/react-core";
import { sprintf } from "sprintf-js";

import { _ } from "~/i18n";
import { deviceChildren, deviceSize } from '~/components/storage/utils';
import {
  DeviceName, DeviceDetails, DeviceSize, toStorageDevice
} from "~/components/storage/device-utils";
import { TreeTable } from "~/components/core";
import { Icon } from "~/components/layout";

/**
 * @typedef {import("~/client/storage").PartitionSlot} PartitionSlot
 * @typedef {import ("~/client/storage").SpaceAction} SpaceAction
 * @typedef {import ("~/client/storage").StorageDevice} StorageDevice
 * @typedef {import("../core/TreeTable").TreeTableColumn} TreeTableColumn
 */

/**
 * Info about the device.
 * @component
 *
 * @param {object} props
 * @param {StorageDevice} props.device
 */
const DeviceInfoContent = ({ device }) => {
  const minSize = device.shrinking?.supported;

  if (minSize) {
    const recoverable = device.size - minSize;
    return (
      sprintf(_("Up to %s can be recovered by shrinking the device."), deviceSize(recoverable))
    );
  }

  const reasons = device.shrinking.unsupported;

  return (
    <>
      {_("The device cannot be shrunk:")}
      <List>
        {reasons.map((reason, idx) => <ListItem key={idx}>{reason}</ListItem>)}
      </List>
    </>
  );
};

/**
 * Button to show a popup with info about the device.
 * @component
 *
 * @param {object} props
 * @param {StorageDevice} props.device
 */
const DeviceInfo = ({ device }) => {
  return (
    <Popover
      headerContent={device.name}
      bodyContent={<DeviceInfoContent device={device} />}
    >
      <Button
        aria-label={sprintf(_("Show information about %s"), device.name)}
        variant="plain"
        icon={<Icon name="info" size="xs" />}
      />
    </Popover>
  );
};

/**
 * Space action selector.
 * @component
 *
 * @param {object} props
 * @param {StorageDevice} props.device
 * @param {string} props.action - Possible values: "force_delete", "resize" or "keep".
 * @param {(action: SpaceAction) => void} [props.onChange]
 */
const DeviceActionSelector = ({ device, action, onChange }) => {
  const changeAction = (action) => onChange({ device: device.name, action });

  const isResizeDisabled = device.shrinking?.supported === undefined;
  const hasInfo = device.shrinking !== undefined;

  return (
    <Flex>
      <FlexItem>
        <ToggleGroup isCompact>
          <ToggleGroupItem
            text="Do not modify"
            buttonId="not-modify"
            isSelected={action === "keep"}
            onChange={() => changeAction("keep")}
          />
          <ToggleGroupItem
            text="Allow shrink"
            buttonId="resize"
            isDisabled={isResizeDisabled}
            isSelected={action === "resize"}
            onChange={() => changeAction("resize")}
          />
          <ToggleGroupItem
            text="Delete"
            buttonId="delete"
            isSelected={action === "force_delete"}
            onChange={() => changeAction("force_delete")}
          />
        </ToggleGroup>
      </FlexItem>
      {hasInfo && <FlexItem><DeviceInfo device={device} /></FlexItem>}
    </Flex>
  );
};

/**
 * Column content with the space action (a form or a description) for a device
 * @component
 *
 * @param {object} props
 * @param {PartitionSlot|StorageDevice} props.item
 * @param {string} props.action - Possible values: "force_delete", "resize" or "keep".
 * @param {(action: SpaceAction) => void} [props.onChange]
 */
const DeviceAction = ({ item, action, onChange }) => {
  const device = toStorageDevice(item);
  if (!device) return null;

  if (device.type === "partition") {
    return (
      <DeviceActionSelector
        device={device}
        action={action}
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
 * @property {(item: PartitionSlot|StorageDevice) => string} deviceAction - Gets the action for a device.
 * @property {(action: SpaceAction) => void} onActionChange
 *
 * @param {SpaceActionsTableProps} props
 */
export default function SpaceActionsTable({
  devices,
  expandedDevices = [],
  deviceAction,
  onActionChange,
}) {
  /** @type {TreeTableColumn[]} */
  const columns = [
    { name: _("Device"), value: (item) => <DeviceName item={item} /> },
    { name: _("Details"), value: (item) => <DeviceDetails item={item} /> },
    { name: _("Size"), value: (item) => <DeviceSize item={item} /> },
    {
      name: _("Action"),
      value: (item) => (
        <DeviceAction
          item={item}
          action={deviceAction(item)}
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
