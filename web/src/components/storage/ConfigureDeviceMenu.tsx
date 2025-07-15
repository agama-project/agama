/*
 * Copyright (c) [2025] SUSE LLC
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

import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import MenuButton, { MenuButtonItem } from "~/components/core/MenuButton";
import { Divider, MenuItemProps } from "@patternfly/react-core";
import { useAvailableDevices } from "~/hooks/storage/system";
import { useModel } from "~/hooks/storage/model";
import { useAddDrive } from "~/hooks/storage/drive";
import { useAddReusedMdRaid } from "~/hooks/storage/md-raid";
import { STORAGE as PATHS } from "~/routes/paths";
import { sprintf } from "sprintf-js";
import { _, n_ } from "~/i18n";
import { StorageDevice } from "~/types/storage";
import DeviceSelectorModal from "./DeviceSelectorModal";

type AddDeviceMenuItemProps = {
  /** Available devices to be chosen */
  devices: StorageDevice[];
  /** The total amount of drives and RAIDs already configured */
  usedCount: number;
} & MenuItemProps;

const AddDeviceTitle = ({ usedCount }) =>
  usedCount
    ? _("Select another disk to define partitions")
    : _("Select a disk to define partitions");

const AddDeviceDescription = ({ usedCount, isDisabled = false }) => {
  if (isDisabled) return _("Already using all available disks");

  return usedCount
    ? sprintf(
        n_(
          "Extend the installation beyond the currently selected disk",
          "Extend the installation beyond the current %d disks",
          usedCount,
        ),
        usedCount,
      )
    : _("Start configuring a basic installation");
};

/**
 * Internal component holding the logic for rendering the disks drilldown menu
 */
const AddDeviceMenuItem = ({
  usedCount,
  devices,
  onClick,
}: AddDeviceMenuItemProps): React.ReactNode => {
  const isDisabled = !devices.length;
  return (
    <>
      <MenuButtonItem
        aria-label={_("Add device menu")}
        isDisabled={isDisabled}
        description={<AddDeviceDescription usedCount={usedCount} isDisabled={isDisabled} />}
        onClick={onClick}
      >
        <AddDeviceTitle usedCount={usedCount} />
      </MenuButtonItem>
    </>
  );
};

/**
 * Menu that provides options for users to configure storage drives
 *
 * It uses a drilled-down menu approach for disks, making the available options less
 * overwhelming by presenting them in a more organized manner.
 *
 * TODO: Refactor and test the component after extracting a basic DrillDown menu to
 * share the internal logic with other potential menus that could benefit from a similar
 * approach.
 */
export default function ConfigureDeviceMenu(): React.ReactNode {
  const [deviceSelectorOpen, setDeviceSelectorOpen] = useState(false);
  const openDeviceSelector = () => setDeviceSelectorOpen(true);
  const closeDeviceSelector = () => setDeviceSelectorOpen(false);

  const navigate = useNavigate();

  const model = useModel({ suspense: true });
  const addDrive = useAddDrive();
  const addReusedMdRaid = useAddReusedMdRaid();
  const allDevices = useAvailableDevices();

  const usedDevicesNames = model.drives.concat(model.mdRaids).map((d) => d.name);
  const usedDevicesCount = usedDevicesNames.length;
  const devices = allDevices.filter((d) => !usedDevicesNames.includes(d.name));

  const addDevice = (device: StorageDevice) => {
    const hook = device.isDrive ? addDrive : addReusedMdRaid;
    hook({ name: device.name, spacePolicy: "keep" });
  };

  const lvmDescription = allDevices.length
    ? _("Define a new LVM on top of one or several disks")
    : _("Define a new LVM on the disk");

  return (
    <>
      <MenuButton
        menuProps={{
          "aria-label": _("Configure device menu"),
        }}
        items={[
          <AddDeviceMenuItem
            key="select-disk-option"
            usedCount={usedDevicesCount}
            devices={devices}
            onClick={openDeviceSelector}
          />,
          <Divider key="divider-option" />,
          <MenuButtonItem
            key="add-lvm-option"
            onClick={() => navigate(PATHS.volumeGroup.add)}
            description={lvmDescription}
          >
            {_("Add LVM volume group")}
          </MenuButtonItem>,
        ]}
      >
        {_("More devices")}
      </MenuButton>
      {deviceSelectorOpen && (
        <DeviceSelectorModal
          devices={devices}
          title={<AddDeviceTitle usedCount={usedDevicesCount} />}
          description={<AddDeviceDescription usedCount={usedDevicesCount} />}
          onCancel={closeDeviceSelector}
          onConfirm={([device]) => {
            addDevice(device);
            closeDeviceSelector();
          }}
        />
      )}
    </>
  );
}
