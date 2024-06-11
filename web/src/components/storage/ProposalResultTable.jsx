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
import { Label, Flex } from "@patternfly/react-core";
import {
  DeviceName, DeviceDetails, DeviceSize, toStorageDevice
} from "~/components/storage/device-utils";
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import DevicesManager from "~/components/storage/DevicesManager";
import { TreeTable } from "~/components/core";
import { _ } from "~/i18n";
import { sprintf } from "sprintf-js";
import { deviceChildren, deviceSize } from "~/components/storage/utils";

/**
 * @typedef {import("~/client/storage").PartitionSlot} PartitionSlot
 * @typedef {import ("~/client/storage").StorageDevice} StorageDevice
 * @typedef {import("../core/TreeTable").TreeTableColumn} TreeTableColumn
 * @typedef {StorageDevice | PartitionSlot} TableItem
 */

/**
 * @component
 * @param {object} props
 * @param {TableItem} props.item
 */
const MountPoint = ({ item }) => {
  const device = toStorageDevice(item);

  if (!(device && device.filesystem?.mountPath)) return null;

  return <em>{device.filesystem.mountPath}</em>;
};

/**
 * @component
 * @param {object} props
 * @param {TableItem} props.item
 * @param {DevicesManager} props.devicesManager
 */
const DeviceCustomDetails = ({ item, devicesManager }) => {
  const isNew = () => {
    const device = toStorageDevice(item);
    if (!device) return false;

    // FIXME New PVs over a disk is not detected as new.
    return !devicesManager.existInSystem(device) || devicesManager.hasNewFilesystem(device);
  };

  return (
    <Flex direction={{ default: "row" }} gap={{ default: "gapXs" }}>
      <DeviceDetails item={item} />
      {isNew() && <Label color="green" isCompact>{_("New")}</Label>}
    </Flex>
  );
};

/**
 * @component
 * @param {object} props
 * @param {TableItem} props.item
 * @param {DevicesManager} props.devicesManager
 */
const DeviceCustomSize = ({ item, devicesManager }) => {
  const device = toStorageDevice(item);
  const isResized = device && devicesManager.isShrunk(device);
  const sizeBefore = isResized ? devicesManager.systemDevice(device.sid).size : item.size;

  return (
    <Flex direction={{ default: "row" }} gap={{ default: "gapXs" }}>
      <DeviceSize item={item} />
      {isResized &&
        <Label color="orange" isCompact>
          {
            // TRANSLATORS: Label to indicate the device size before resizing, where %s is
            // replaced by the original size (e.g., 3.00 GiB).
            sprintf(_("Before %s"), deviceSize(sizeBefore))
          }
        </Label>}
    </Flex>
  );
};

/** @type {(devicesManager: DevicesManager) => TreeTableColumn[] } */
const columns = (devicesManager) => {
  /** @type {(item: TableItem) => React.ReactNode} */
  const renderDevice = (item) => <DeviceName item={item} />;

  /** @type {(item: TableItem) => React.ReactNode} */
  const renderMountPoint = (item) => <MountPoint item={item} />;

  /** @type {(item: TableItem) => React.ReactNode} */
  const renderDetails = (item) => <DeviceCustomDetails item={item} devicesManager={devicesManager} />;

  /** @type {(item: TableItem) => React.ReactNode} */
  const renderSize = (item) => <DeviceCustomSize item={item} devicesManager={devicesManager} />;

  return [
    { name: _("Device"), value: renderDevice },
    { name: _("Mount Point"), value: renderMountPoint },
    { name: _("Details"), value: renderDetails },
    { name: _("Size"), value: renderSize, classNames: "sizes-column" }
  ];
};

/**
 * Renders the proposal result.
 * @component
 *
 * @typedef {object} ProposalResultTableProps
 * @property {DevicesManager} devicesManager
 *
 * @param {ProposalResultTableProps} props
 */
export default function ProposalResultTable({ devicesManager }) {
  const devices = devicesManager.usedDevices();

  return (
    <TreeTable
      columns={columns(devicesManager)}
      items={devices}
      expandedItems={devices}
      itemChildren={deviceChildren}
      rowClassNames={(item) => {
        if (!item.sid) return "dimmed-row";
      }}
      className="proposal-result"
    />
  );
}
