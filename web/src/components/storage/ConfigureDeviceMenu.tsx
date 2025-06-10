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
import { useAvailableDevices, useLongestDiskTitle } from "~/queries/storage";
import { useConfigModel, useModel } from "~/queries/storage/config-model";
import { STORAGE as PATHS } from "~/routes/paths";
import { sprintf } from "sprintf-js";
import { _, n_ } from "~/i18n";
import DeviceSelectorModal from "./DeviceSelectorModal";
import { Divider } from "@patternfly/react-core";

/**
 * Internal component holding the logic for rendering the disks drilldown menu
 */
const AddDeviceMenuItem = ({ drivesCount, devices, onClick, children }): React.ReactNode => {
  const isDisabled = !devices.length;

  const disabledDescription = _("Already using all available disks");
  const enabledDescription = drivesCount
    ? sprintf(
        n_(
          "Extend the installation beyond the currently selected disk",
          "Extend the installation beyond the current %d disks",
          drivesCount,
        ),
        drivesCount,
      )
    : _("Start configuring a basic installation");

  return (
    <MenuButtonItem
      isDisabled={isDisabled}
      description={isDisabled ? disabledDescription : enabledDescription}
      onClick={onClick}
    >
      {children}
    </MenuButtonItem>
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
  const navigate = useNavigate();
  const model = useConfigModel({ suspense: true });
  const { addDrive } = useModel();
  const allDevices = useAvailableDevices();
  const [deviceSelectorOpen, setDeviceSelectorOpen] = useState(false);
  const openDeviceSelector = () => setDeviceSelectorOpen(true);
  const closeDeviceSelector = () => setDeviceSelectorOpen(false);

  const drivesNames = model.drives.map((d) => d.name);
  const drivesCount = drivesNames.length;
  const devices = allDevices.filter((d) => !drivesNames.includes(d.name));
  const longestTitle = useLongestDiskTitle();

  const lvmDescription = allDevices.length
    ? _("Define a new LVM on top of one or several disks")
    : _("Define a new LVM on the disk");

  const title = drivesCount
    ? _("Select another disk to define partitions")
    : _("Select a disk to define partitions");

  return (
    <>
      <MenuButton
        menuProps={{
          "aria-label": _("Configure device menu"),
          popperProps: { minWidth: `min(${longestTitle * 0.75}em, 75vw)`, width: "max-content" },
        }}
        items={[
          <AddDeviceMenuItem
            key="select-disk-option"
            drivesCount={drivesCount}
            devices={devices}
            onClick={openDeviceSelector}
          >
            {title}
          </AddDeviceMenuItem>,
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
          devices={allDevices}
          title={title}
          onCancel={closeDeviceSelector}
          onAccept={([device]) => {
            addDrive(device.name);
            closeDeviceSelector();
          }}
        />
      )}
    </>
  );
}
