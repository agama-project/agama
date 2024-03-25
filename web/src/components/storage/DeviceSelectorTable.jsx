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
import { sprintf } from "sprintf-js";
import { deviceSize } from '~/components/storage/utils';
import { Icon } from "~/components/layout";
import { If, ExpandableSelector } from "~/components/core";

/**
 * @typedef {import ("~/client/storage").ProposalSettings} ProposalSettings
 * @typedef {import ("~/client/storage").StorageDevice} StorageDevice
 */

const DeviceContent = ({ device }) => {
  const PTable = () => {
    if (device.partitionTable === undefined) return null;

    const type = device.partitionTable.type.toUpperCase();
    const numPartitions = device.partitionTable.partitions?.length;

    // TRANSLATORS: disk partition info, %s is replaced by partition table
    // type (MS-DOS or GPT), %d is the number of the partitions
    const text = sprintf(_("%s with %d partitions"), type, numPartitions);

    return (
      <div>
        <Icon name="folder" size="14" /> {text}
      </div>
    );
  };

  const Systems = () => {
    if (device.systems.length === 0) return null;

    const System = ({ system }) => {
      const logo = /windows/i.test(system) ? "windows_logo" : "linux_logo";

      return <div><Icon name={logo} size="14" /> {system}</div>;
    };

    return device.systems.map((s, i) => <System key={i} system={s} />);
  };

  const NotFound = () => {
    // TRANSLATORS: status message, no existing content was found on the disk,
    // i.e. the disk is completely empty
    return <div><Icon name="folder_off" size="14" /> {_("No content found")}</div>;
  };

  const hasContent = device.partitionTable || device.systems?.length > 0;

  return (
    <div>
      <If
        condition={hasContent}
        then={<><PTable /><Systems /></>}
        else={<NotFound />}
      />
    </div>
  );
};

const deviceColumns = [
  { name: _("Device"), value: (item) => item.name },
  { name: _("Content"), value: (item) => <DeviceContent device={item} /> },
  { name: _("Size"), value: (item) => deviceSize(item.size) }
];

export default function DeviceSelectorTable({ devices, selected, ...props }) {
  return (
    <ExpandableSelector
      columns={deviceColumns}
      items={devices}
      itemIdKey="sid"
      itemsSelected={selected}
      {...props}
    />
  );
}
