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

import React from "react";
import { useNavigate } from "react-router-dom";
import { Split, Flex, Label, Divider } from "@patternfly/react-core";
import MenuButton, { MenuButtonItem } from "~/components/core/MenuButton";
import MenuDeviceDescription from "./MenuDeviceDescription";
import { useAvailableDrives, useLongestDiskTitle } from "~/hooks/storage/system";
import { useConfigModel, useModel } from "~/queries/storage/config-model";
import { deviceLabel } from "~/components/storage/utils";
import { STORAGE as PATHS } from "~/routes/paths";
import { sprintf } from "sprintf-js";
import { _, n_ } from "~/i18n";
import { StorageDevice } from "~/types/storage";

type DisksDrillDownMenuItemProps = {
  /** Available devices to be chosen */
  devices: StorageDevice[];
  /** The amount of drives already configured */
  drivesCount: number;
  /** Callback function to be triggered when a device is selected */
  onDeviceClick: (deviceName: StorageDevice["name"]) => void;
};

/**
 * Internal component holding the logic for rendering the disks drilldown menu
 */
const DisksDrillDownMenuItem = ({
  drivesCount,
  devices,
  onDeviceClick,
}: DisksDrillDownMenuItemProps): React.ReactNode => {
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
  const title = drivesCount
    ? _("Select another disk to define partitions")
    : _("Select a disk to define partitions");

  return (
    <MenuButtonItem
      aria-label={_("Add device menu")}
      isDisabled={isDisabled}
      description={isDisabled ? disabledDescription : enabledDescription}
      items={devices.map((device) => (
        <MenuButtonItem
          key={device.sid}
          description={<MenuDeviceDescription device={device} />}
          onClick={() => onDeviceClick(device.name)}
        >
          <Split hasGutter>
            {deviceLabel(device, true)}
            <Flex columnGap={{ default: "columnGapXs" }}>
              {device.systems.map((s, i) => (
                <Label key={i} isCompact>
                  {s}
                </Label>
              ))}
            </Flex>
          </Split>
        </MenuButtonItem>
      ))}
    >
      {title}
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
  const allDevices = useAvailableDrives();

  const drivesNames = model.drives.map((d) => d.name);
  const drivesCount = drivesNames.length;
  const devices = allDevices.filter((d) => !drivesNames.includes(d.name));
  const longestTitle = useLongestDiskTitle();

  const lvmDescription = allDevices.length
    ? _("Define a new LVM on top of one or several disks")
    : _("Define a new LVM on the disk");

  return (
    <MenuButton
      menuProps={{
        "aria-label": _("Configure device menu"),
        popperProps: { minWidth: `min(${longestTitle * 0.75}em, 75vw)`, width: "max-content" },
      }}
      items={[
        <DisksDrillDownMenuItem
          key="select-disk-option"
          drivesCount={drivesCount}
          devices={devices}
          onDeviceClick={addDrive}
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
  );
}
