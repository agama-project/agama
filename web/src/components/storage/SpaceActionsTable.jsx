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

import { _ } from "~/i18n";
import { FilesystemLabel } from "~/components/storage";
import { deviceChildren, deviceSize } from '~/components/storage/utils';
import { Tag, TreeTable } from "~/components/core";
import { sprintf } from "sprintf-js";

/**
 * @typedef {import ("~/client/storage").SpaceAction} SpaceAction
 * @typedef {import ("~/client/storage").StorageDevice} StorageDevice
 */

/**
 * Column content.
 * @component
 *
 * @param {object} props
 * @param {StorageDevice} props.device
 */
const DeviceName = ({ device }) => {
  let name = device.sid && device.name;
  // NOTE: returning a fragment here to avoid a weird React complaint when using a PF/Table +
  // treeRow props.
  if (!name) return <></>;

  if (["partition"].includes(device.type))
    name = name.split("/").pop();

  return (
    <span>{name}</span>
  );
};

/**
 * Column content.
 * @component
 *
 * @param {object} props
 * @param {StorageDevice} props.device
 */
const DeviceDetails = ({ device }) => {
  if (!device.sid) return _("Unused space");

  const renderContent = (device) => {
    if (!device.partitionTable && device.systems?.length > 0)
      return device.systems.join(", ");

    return device.description;
  };

  const renderPTableType = (device) => {
    const type = device.partitionTable?.type;
    if (type) return <Tag><b>{type.toUpperCase()}</b></Tag>;
  };

  return (
    <div>{renderContent(device)} <FilesystemLabel device={device} /> {renderPTableType(device)}</div>
  );
};

/**
 * Column content.
 * @component
 *
 * @param {object} props
 * @param {StorageDevice} props.device
 */
const DeviceSizeDetails = ({ device }) => {
  if (!device.sid || device.isDrive || device.recoverableSize === 0) return null;

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
 * @param {StorageDevice} props.device
 * @param {string} props.action - Possible values: "force_delete", "resize" or "keep".
 * @param {boolean} [props.isDisabled=false]
 * @param {(action: SpaceAction) => void} [props.onChange]
 */
const DeviceAction = ({ device, action, isDisabled = false, onChange }) => {
  if (!device.sid) return null;

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
 * @param {object} props
 * @param {StorageDevice[]} props.devices
 * @param {StorageDevice[]} [props.expandedDevices=[]] - Initially expanded devices.
 * @param {boolean} [props.isActionDisabled=false] - Whether the action selector is disabled.
 * @param {(device: StorageDevice) => string} props.deviceAction - Gets the action for a device.
 * @param {(action: SpaceAction) => void} props.onActionChange
 */
export default function SpaceActionsTable({
  devices,
  expandedDevices = [],
  isActionDisabled = false,
  deviceAction,
  onActionChange,
}) {
  const columns = [
    { title: _("Device"), content: (device) => <DeviceName device={device} /> },
    { title: _("Details"), content: (device) => <DeviceDetails device={device} /> },
    { title: _("Size"), content: (device) => deviceSize(device.size) },
    { title: _("Shrinkable"), content: (device) => <DeviceSizeDetails device={device} /> },
    {
      title: _("Action"),
      content: (device) => (
        <DeviceAction
          device={device}
          action={deviceAction(device)}
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
      itemChildren={d => deviceChildren(d)}
      rowClassNames={(item) => {
        if (!item.sid) return "dimmed-row";
      }}
      className="devices-table"
    />
  );
}
