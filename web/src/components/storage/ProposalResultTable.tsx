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
import { Flex } from "@patternfly/react-core";
import {
  DeviceName,
  DeviceDetails,
  DeviceSize,
  toDevice,
  toPartitionSlot,
} from "~/components/storage/device-utils";
import DevicesManager from "~/model/storage/devices-manager";
import { TreeTable } from "~/components/core";
import { _ } from "~/i18n";
import { sprintf } from "sprintf-js";
import { deviceChildren, deviceSize } from "~/components/storage/utils";
import { TreeTableColumn } from "~/components/core/TreeTable";
import type { Storage as Proposal } from "~/model/proposal";

type TableItem = Proposal.Device | Proposal.UnusedSlot;

/**
 * @component
 */
const MountPoint = ({ item }: { item: TableItem }) => {
  const device = toDevice(item);

  if (!(device && device.filesystem?.mountPath)) return null;

  return <em>{device.filesystem.mountPath}</em>;
};

/**
 * @component
 */
const DeviceCustomDetails = ({
  item,
  devicesManager,
  link,
}: {
  item: TableItem;
  devicesManager: DevicesManager;
  link?: (device: Proposal.Device) => React.ReactNode;
}) => {
  const device = toDevice(item);

  /* What the installer does to the device, where it does anything: the device
     is not there yet, or it is there and gets a new file system. Said in words
     under the details rather than marked, so the reader is not left to work out
     what a mark on a row means. */
  // FIXME New PVs over a disk is not detected as new.
  const change = () => {
    if (!device) return null;
    // TRANSLATORS: reads under the details of a device that does not exist yet and
    // that the installer creates.
    if (!devicesManager.existInSystem(device)) return { kind: "created", text: _("Newly created") };
    // TRANSLATORS: reads under the details of a device that already exists and that
    // the installer formats, which destroys what is on it.
    if (devicesManager.hasNewFilesystem(device))
      return { kind: "reformatted", text: _("Reformatted") };

    return null;
  };

  const note = change();

  return (
    <>
      <Flex direction={{ default: "row" }} gap={{ default: "gapXs" }}>
        <DeviceDetails item={item} />
        {device && link?.(device)}
      </Flex>
      {note && <div className={`agm-row-note agm-row-note-${note.kind}`}>{note.text}</div>}
    </>
  );
};

/**
 * @component
 */
const DeviceCustomSize = ({
  item,
  devicesManager,
}: {
  item: TableItem;
  devicesManager: DevicesManager;
}) => {
  const device = toDevice(item);
  const isResized = device && devicesManager.isShrunk(device);
  const sizeBefore = isResized
    ? devicesManager.systemDevice(device.sid).block.size
    : toPartitionSlot(item)?.size;

  return (
    <>
      <DeviceSize item={item} />
      {isResized && (
        <div className="agm-row-note agm-row-note-shrunk">
          {
            // TRANSLATORS: reads under the size a device ends up with, where %s is the
            // size it has today (e.g., 3.00 GiB).
            sprintf(_("Shrunk from %s"), deviceSize(sizeBefore))
          }
        </div>
      )}
    </>
  );
};

const columns: (
  devicesManager: DevicesManager,
  link?: (device: Proposal.Device) => React.ReactNode,
) => TreeTableColumn[] = (devicesManager, link) => {
  const renderDevice: (item: TableItem) => React.ReactNode = (item): React.ReactNode => (
    <DeviceName item={item} />
  );

  const renderMountPoint: (item: TableItem) => React.ReactNode = (item) => (
    <MountPoint item={item} />
  );

  const renderDetails: (item: TableItem) => React.ReactNode = (item) => (
    <DeviceCustomDetails item={item} devicesManager={devicesManager} link={link} />
  );

  const renderSize: (item: TableItem) => React.ReactNode = (item) => (
    <DeviceCustomSize item={item} devicesManager={devicesManager} />
  );

  return [
    { name: _("Device"), value: renderDevice },
    { name: _("Mount point"), value: renderMountPoint },
    { name: _("Details"), value: renderDetails },
    { name: _("Size"), value: renderSize, classNames: "sizes-column" },
  ];
};

type ProposalResultTableProps = {
  devicesManager: DevicesManager;
  /** Rows to render, each with its own children. */
  devices: TableItem[];
  /** Reads beside a row's details: where the device the row describes is used. */
  deviceLink?: (device: Proposal.Device) => React.ReactNode;
};

/**
 * Renders the final layout of the given devices.
 *
 * The devices come from the caller so that the same table can show the whole
 * machine or a single device.
 *
 * @component
 */
export default function ProposalResultTable({
  devicesManager,
  devices,
  deviceLink,
}: ProposalResultTableProps) {
  return (
    <TreeTable
      columns={columns(devicesManager, deviceLink)}
      items={devices}
      expandedItems={devices}
      itemChildren={deviceChildren}
      rowClassNames={(item: TableItem) => {
        if (!toDevice(item)) return "dimmed-row";
      }}
      className="proposal-result"
    />
  );
}
