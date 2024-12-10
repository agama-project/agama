/*
 * Copyright (c) [2024] SUSE LLC
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

// @ts-check

import React from "react";
import {
  Button,
  Flex,
  FlexItem,
  List,
  ListItem,
  Popover,
  ToggleGroup,
  ToggleGroupItem,
} from "@patternfly/react-core";
import { sprintf } from "sprintf-js";

import { _ } from "~/i18n";
import { deviceSize } from "~/components/storage/utils";
import {
  DeviceName,
  DeviceDetails,
  DeviceSize,
  toStorageDevice,
} from "~/components/storage/device-utils";
import { Icon } from "~/components/layout";
import { PartitionSlot, SpacePolicyAction, StorageDevice } from "~/types/storage";
import { TreeTableColumn } from "~/components/core/TreeTable";
import { Table, Td, Th, Tr, Thead, Tbody } from "@patternfly/react-table";

/**
 * Info about the device.
 * @component
 */
const DeviceInfoContent = ({ device }: { device: StorageDevice }) => {
  const minSize = device.shrinking?.supported;

  if (minSize) {
    const recoverable = device.size - minSize;
    return sprintf(
      _("Up to %s can be recovered by shrinking the device."),
      deviceSize(recoverable),
    );
  }

  const reasons = device.shrinking.unsupported;

  return (
    <>
      {_("The device cannot be shrunk:")}
      <List>
        {reasons.map((reason, idx) => (
          <ListItem key={idx}>{reason}</ListItem>
        ))}
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
const DeviceInfo = ({ device }: { device: StorageDevice }) => {
  return (
    <Popover headerContent={device.name} bodyContent={<DeviceInfoContent device={device} />}>
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
 * @param props
 * @param props.device
 * @param props.action - Possible values: "force_delete", "resize" or "keep".
 * @param props.onChange
 */
const DeviceActionSelector = ({
  device,
  action,
  onChange,
}: {
  device: StorageDevice;
  action: string;
  onChange?: (action: SpacePolicyAction) => void;
}) => {
  const changeAction = (value) => onChange({ deviceName: device.name, value });

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
            isSelected={action === "resizeIfNeeded"}
            onChange={() => changeAction("resizeIfNeeded")}
          />
          <ToggleGroupItem
            text="Delete"
            buttonId="delete"
            isSelected={action === "delete"}
            onChange={() => changeAction("delete")}
          />
        </ToggleGroup>
      </FlexItem>
      {hasInfo && (
        <FlexItem>
          <DeviceInfo device={device} />
        </FlexItem>
      )}
    </Flex>
  );
};

/**
 * Column content with the space action (a form or a description) for a device
 * @component
 *
 * @param {object} props
 * @param props.item
 * @param props.action - Possible values: "force_delete", "resize" or "keep".
 * @param props.onChange
 */
const DeviceAction = ({
  item,
  action,
  onChange,
}: {
  item: PartitionSlot | StorageDevice;
  action: string;
  onChange?: (action: SpacePolicyAction) => void;
}) => {
  const device = toStorageDevice(item);
  if (!device) return null;

  if (device.type === "partition") {
    return <DeviceActionSelector device={device} action={action} onChange={onChange} />;
  }

  if (device.filesystem || device.component) return _("The content may be deleted");

  if (!device.partitionTable || device.partitionTable.partitions.length === 0)
    return _("No content found");

  return null;
};

export type SpaceActionsTableProps = {
  devices: (PartitionSlot | StorageDevice)[];
  deviceAction: (item: PartitionSlot | StorageDevice) => string;
  onActionChange: (action: SpacePolicyAction) => void;
};

/**
 * Table for selecting the space actions of the given devices.
 * @component
 */
export default function SpaceActionsTable({
  devices = [],
  deviceAction,
  onActionChange,
}: SpaceActionsTableProps) {
  const columns: TreeTableColumn[] = [
    { name: _("Device"), value: (item) => <DeviceName item={item} /> },
    { name: _("Details"), value: (item) => <DeviceDetails item={item} /> },
    { name: _("Size"), value: (item) => <DeviceSize item={item} /> },
    {
      name: _("Action"),
      value: (item) => (
        <DeviceAction item={item} action={deviceAction(item)} onChange={onActionChange} />
      ),
    },
  ];

  return (
    <Table variant="compact" className="devices-table">
      <Thead noWrap>
        <Tr>
          {columns.map((c, i) => (
            <Th key={i} className={c.classNames}>
              {c.name}
            </Th>
          ))}
        </Tr>
      </Thead>
      <Tbody>
        {devices.map((d) => (
          <Tr key={toStorageDevice(d).sid}>
            {columns.map((c, i) => (
              <Td key={i} className={c.classNames}>
                {c.value(d)}
              </Td>
            ))}
          </Tr>
        ))}
      </Tbody>
    </Table>
  );
}
