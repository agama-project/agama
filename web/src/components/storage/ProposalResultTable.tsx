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
import { _, TranslatedString } from "~/i18n";
import { sprintf } from "sprintf-js";
import { deviceChildren, deviceSize } from "~/components/storage/utils";
import { TreeTableColumn } from "~/components/core/TreeTable";
import { useConfigModel } from "~/hooks/model/storage/config-model";
import type { Storage as Proposal } from "~/model/proposal";

/** A row of the final layout: a device, or the free space between two of them. */
export type TableItem = Proposal.Device | Proposal.UnusedSlot;

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
}: {
  item: TableItem;
  devicesManager: DevicesManager;
}) => {
  const device = toDevice(item);

  /* Said in words under the details rather than with a colored mark. */
  const change = (): TranslatedString | null => {
    if (!device) return null;
    // FIXME New PVs over a disk is not detected as new.
    if (!devicesManager.existInSystem(device)) {
      // TRANSLATORS: a device the installer creates
      return _("Newly created");
    }
    if (devicesManager.hasNewFilesystem(device)) {
      // TRANSLATORS: an existing device the installer formats, losing its data
      return _("Reformatted");
    }

    return null;
  };

  const note = change();

  return (
    <>
      <Flex direction={{ default: "row" }} gap={{ default: "gapXs" }}>
        <DeviceDetails item={item} />
      </Flex>
      {note && <div className="agm-row-note">{note}</div>}
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
        <div className="agm-row-note">
          {
            // TRANSLATORS: %s is the current size of a device, such as "3.00 GiB"
            sprintf(_("Shrunk from %s"), deviceSize(sizeBefore))
          }
        </div>
      )}
    </>
  );
};

const columns: (devicesManager: DevicesManager) => TreeTableColumn[] = (devicesManager) => {
  const renderDevice: (item: TableItem) => React.ReactNode = (item): React.ReactNode => (
    <DeviceName item={item} />
  );

  const renderMountPoint: (item: TableItem) => React.ReactNode = (item) => (
    <MountPoint item={item} />
  );

  const renderDetails: (item: TableItem) => React.ReactNode = (item) => (
    <DeviceCustomDetails item={item} devicesManager={devicesManager} />
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
};

/**
 * Renders the proposal result.
 * @component
 */
export default function ProposalResultTable({ devicesManager }: ProposalResultTableProps) {
  const model = useConfigModel();
  const shown = devicesManager.usedDevices(model?.drives?.map((d) => d.name) || []);

  return (
    <TreeTable
      columns={columns(devicesManager)}
      items={shown}
      expandedItems={shown}
      itemChildren={deviceChildren}
      rowClassNames={(item: TableItem) => {
        if (!toDevice(item)) return "dimmed-row";
      }}
      className="proposal-result"
      hasVerticallyCenteredRows
    />
  );
}
