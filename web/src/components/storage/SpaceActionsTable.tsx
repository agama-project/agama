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
import { deviceSize, formattedPath } from "~/components/storage/utils";
import { DeviceName, DeviceDetails, DeviceSize, toDevice } from "~/components/storage/device-utils";
import { Icon } from "~/components/layout";
import { Device, UnusedSlot } from "~/api/proposal/storage";
import { model } from "~/api/storage";
import { TreeTableColumn } from "~/components/core/TreeTable";
import { Table, Td, Th, Tr, Thead, Tbody } from "@patternfly/react-table";
import { useStorageModel } from "~/hooks/api/storage";
import { supportShrink } from "~/storage/device";

export type SpacePolicyAction = {
  deviceName: string;
  value: "delete" | "resizeIfNeeded";
};

const isUsedPartition = (partition: model.Partition): boolean => {
  return partition.filesystem !== undefined;
};

// FIXME: there is too much logic here. This is one of those cases that should be considered
// when restructuring the hooks and queries.
const useReusedPartition = (name: string): model.Partition | undefined => {
  const model = useStorageModel();

  if (!model || !name) return;

  const allPartitions = model.drives.flatMap((d) => d.partitions);
  return allPartitions.find((p) => p.name === name && isUsedPartition(p));
};

/**
 * Info about the device.
 * @component
 */
const DeviceInfoContent = ({ device }: { device: Device }) => {
  const minSize = device.block?.shrinking?.minSize;

  const reused = useReusedPartition(device.name);
  if (reused) {
    if (!reused.mountPath) return _("The device will be used by the new system.");

    // TRANSLATORS: %s is a mount path like "/home".
    return sprintf(_("The device will be mounted at %s."), formattedPath(reused.mountPath));
  }

  if (minSize) {
    const recoverable = device.block.size - minSize;
    return sprintf(
      _("Up to %s can be recovered by shrinking the device."),
      deviceSize(recoverable),
    );
  }

  const reasons = device.block?.shrinking?.reasons || [];

  return (
    <>
      {_("The device cannot be shrunk:")}
      <List>
        {reasons.map((reason: string, idx: number) => (
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
 * @param {Device} props.device
 */
const DeviceInfo = ({ device }: { device: Device }) => {
  return (
    <Popover headerContent={device.name} bodyContent={<DeviceInfoContent device={device} />}>
      <Button
        aria-label={sprintf(_("Show information about %s"), device.name)}
        variant="plain"
        icon={<Icon name="info" />}
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
  device: Device;
  action: string;
  onChange?: (action: SpacePolicyAction) => void;
}) => {
  const changeAction = (value) => onChange({ deviceName: device.name, value });

  const forceKeep = !!useReusedPartition(device.name);
  // FIXME
  const isResizeDisabled = forceKeep || !supportShrink(device);
  const isDeleteDisabled = forceKeep;
  const hasInfo = forceKeep || device.block?.shrinking !== undefined;
  const adjustedAction = forceKeep ? "keep" : action;

  return (
    <Flex>
      <FlexItem>
        <ToggleGroup isCompact>
          <ToggleGroupItem
            text="Do not modify"
            buttonId="not-modify"
            isSelected={adjustedAction === "keep"}
            onChange={() => changeAction("keep")}
          />
          <ToggleGroupItem
            text="Allow shrink"
            buttonId="resize"
            isDisabled={isResizeDisabled}
            isSelected={adjustedAction === "resizeIfNeeded"}
            onChange={() => changeAction("resizeIfNeeded")}
          />
          <ToggleGroupItem
            text="Delete"
            buttonId="delete"
            isDisabled={isDeleteDisabled}
            isSelected={adjustedAction === "delete"}
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
  item: UnusedSlot | Device;
  action: string;
  onChange?: (action: SpacePolicyAction) => void;
}) => {
  const device = toDevice(item);
  if (!device) return null;

  return <DeviceActionSelector device={device} action={action} onChange={onChange} />;
};

export type SpaceActionsTableProps = {
  devices: (UnusedSlot | Device)[];
  deviceAction: (item: UnusedSlot | Device) => string;
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
    {
      name: _("Device"),
      value: (item: UnusedSlot | Device) => <DeviceName item={item} />,
    },
    {
      name: _("Details"),
      value: (item: UnusedSlot | Device) => <DeviceDetails item={item} />,
    },
    { name: _("Size"), value: (item: UnusedSlot | Device) => <DeviceSize item={item} /> },
    {
      name: _("Action"),
      value: (item: UnusedSlot | Device) => (
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
        {devices.map((d, idx) => (
          <Tr key={idx}>
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
