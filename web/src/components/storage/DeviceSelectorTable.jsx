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

import React from "react";
import { _ } from "~/i18n";
import { deviceSize } from '~/components/storage/utils';
import { DeviceExtendedInfo, DeviceContentInfo } from "~/components/storage";
import { ExpandableSelector } from "~/components/core";

/**
 * @typedef {import ("~/client/storage").ProposalSettings} ProposalSettings
 * @typedef {import ("~/client/storage").StorageDevice} StorageDevice
 */

const DeviceInfo = ({ device }) => {
  if (!device.sid) return _("Unused space");

  return <DeviceExtendedInfo device={device} />;
};

const deviceColumns = [
  { name: _("Device"), value: (device) => <DeviceInfo device={device} /> },
  { name: _("Content"), value: (device) => <DeviceContentInfo device={device} /> },
  { name: _("Size"), value: (device) => deviceSize(device.size), classNames: "sizes-column" }
];

export default function DeviceSelectorTable({ devices, selected, ...props }) {
  return (
    <ExpandableSelector
      columns={deviceColumns}
      items={devices}
      itemIdKey="sid"
      itemClassNames={(device) => {
        if (!device.sid) {
          return "dimmed-row";
        }
      }}
      itemsSelected={selected}
      className="devices-table"
      {...props}
    />
  );
}
