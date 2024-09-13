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
  DeviceName,
  DeviceDetails,
  DeviceSize,
  FilesystemLabel,
  toStorageDevice,
} from "~/components/storage/device-utils";
import { ExpandableSelector } from "~/components/core";
import { Icon } from "~/components/layout";
import { _ } from "~/i18n";
import { sprintf } from "sprintf-js";
import { deviceBaseName } from "~/components/storage/utils";
import { PartitionSlot, StorageDevice } from "~/types/storage";
import { ExpandableSelectorColumn, ExpandableSelectorProps } from "../core/ExpandableSelector";

/**
 * @component
 */
const DeviceInfo = ({ item }: { item: PartitionSlot | StorageDevice }) => {
  const device = toStorageDevice(item);
  if (!device) return null;

  const DeviceType = () => {
    let type: string;

    switch (device.type) {
      case "multipath": {
        // TRANSLATORS: multipath device type
        type = _("Multipath");
        break;
      }
      case "dasd": {
        // TRANSLATORS: %s is replaced by the device bus ID
        type = sprintf(_("DASD %s"), device.busId);
        break;
      }
      case "md": {
        // TRANSLATORS: software RAID device, %s is replaced by the RAID level, e.g. RAID-1
        type = sprintf(_("Software %s"), device.level.toUpperCase());
        break;
      }
      case "disk": {
        if (device.sdCard) {
          type = _("SD Card");
        } else {
          const technology = device.transport || device.bus;
          type = technology
            ? // TRANSLATORS: %s is substituted by the type of disk like "iSCSI" or "SATA"
              sprintf(_("%s disk"), technology)
            : _("Disk");
        }
      }
    }

    return type && <div>{type}</div>;
  };

  const DeviceModel = () => {
    if (!device.model || device.model === "") return null;

    return <div>{device.model}</div>;
  };

  const MDInfo = () => {
    if (device.type !== "md" || !device.devices) return null;

    const members = device.devices.map(deviceBaseName);

    // TRANSLATORS: RAID details, %s is replaced by list of devices used by the array
    return <div>{sprintf(_("Members: %s"), members.sort().join(", "))}</div>;
  };

  const RAIDInfo = () => {
    if (device.type !== "raid") return null;

    const devices = device.devices.map(deviceBaseName);

    // TRANSLATORS: RAID details, %s is replaced by list of devices used by the array
    return <div>{sprintf(_("Devices: %s"), devices.sort().join(", "))}</div>;
  };

  const MultipathInfo = () => {
    if (device.type !== "multipath") return null;

    const wires = device.wires.map(deviceBaseName);

    // TRANSLATORS: multipath details, %s is replaced by list of connections used by the device
    return <div>{sprintf(_("Wires: %s"), wires.sort().join(", "))}</div>;
  };

  return (
    <div>
      <DeviceName item={device} />
      <DeviceType />
      <DeviceModel />
      <MDInfo />
      <RAIDInfo />
      <MultipathInfo />
    </div>
  );
};

/**
 * @component
 */
const DeviceExtendedDetails = ({ item }: { item: PartitionSlot | StorageDevice }) => {
  const device = toStorageDevice(item);

  if (!device || ["partition", "lvmLv"].includes(device.type)) return <DeviceDetails item={item} />;

  // TODO: there is a lot of room for improvement here, but first we would need
  // device.description (comes from YaST) to be way more granular
  const Description = () => {
    if (device.partitionTable) {
      const type = device.partitionTable.type.toUpperCase();
      const numPartitions = device.partitionTable.partitions.length;

      // TRANSLATORS: disk partition info, %s is replaced by partition table
      // type (MS-DOS or GPT), %d is the number of the partitions
      return sprintf(_("%s with %d partitions"), type, numPartitions);
    }

    if (!!device.model && device.model === device.description) {
      // TRANSLATORS: status message, no existing content was found on the disk,
      // i.e. the disk is completely empty
      return _("No content found");
    }

    return (
      <div>
        {device.description} <FilesystemLabel item={device} />
      </div>
    );
  };

  const Systems = () => {
    if (!device.systems || device.systems.length === 0) return null;

    const System = ({ system }) => {
      const logo = /windows/i.test(system) ? "windows_logo" : "linux_logo";

      return (
        <div>
          <Icon name={logo} size="14" /> {system}
        </div>
      );
    };

    return device.systems.map((s, i) => <System key={i} system={s} />);
  };

  return (
    <div>
      <Description />
      <Systems />
    </div>
  );
};

const columns: ExpandableSelectorColumn[] = [
  { name: _("Device"), value: (item) => <DeviceInfo item={item} /> },
  { name: _("Details"), value: (item) => <DeviceExtendedDetails item={item} /> },
  { name: _("Size"), value: (item) => <DeviceSize item={item} />, classNames: "sizes-column" },
];

type DeviceSelectorTableBaseProps = {
  devices: StorageDevice[];
  selectedDevices: StorageDevice[];
};
type DeviceSelectorTableProps = DeviceSelectorTableBaseProps & ExpandableSelectorProps;

/**
 * Table for selecting the installation device.
 * @component
 */
export default function DeviceSelectorTable({
  devices,
  selectedDevices,
  ...props
}: DeviceSelectorTableProps) {
  return (
    <ExpandableSelector
      columns={columns}
      items={devices}
      itemIdKey="sid"
      itemClassNames={(device) => {
        if (!device.sid) {
          return "dimmed-row";
        }
      }}
      itemsSelected={selectedDevices}
      className="devices-table"
      {...props}
    />
  );
}
