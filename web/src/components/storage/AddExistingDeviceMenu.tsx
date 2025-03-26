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

import React, { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  MenuToggle,
  Split,
  Flex,
  Label,
  DrilldownMenu,
  MenuContent,
  Divider,
  MenuContainer,
  Menu,
  MenuList,
  MenuItem,
} from "@patternfly/react-core";
import MenuDeviceDescription from "./MenuDeviceDescription";
import { useAvailableDevices } from "~/queries/storage";
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
}: DisksDrillDownMenuItemProps) => {
  const isDisabled = !devices.length;

  const disabledDescription = _("Already using all availalbe disks.");
  const enabledDescription = drivesCount
    ? sprintf(
        n_(
          "Extends the installation beyond the currently selected disk",
          "Extends the installation beyond the current %d disks",
          drivesCount,
        ),
        drivesCount,
      )
    : _("Extends the installation using a disk");

  return (
    <MenuItem
      itemId="group:disks-menu"
      direction="down"
      isDisabled={isDisabled}
      description={isDisabled ? disabledDescription : enabledDescription}
      drilldownMenu={
        <DrilldownMenu id="disks-menu">
          <MenuItem itemId="group:disks-menu-back" direction="up">
            {_("Back")}
          </MenuItem>
          <Divider />
          {devices.map((device) => (
            <MenuItem
              key={device.sid}
              itemId={device.sid}
              description={<MenuDeviceDescription device={device} />}
              onClick={() => onDeviceClick(device.name)}
            >
              <Split hasGutter>
                {deviceLabel(device)}
                <Flex columnGap={{ default: "columnGapXs" }}>
                  {device.systems.map((s, i) => (
                    <Label key={i} isCompact>
                      {s}
                    </Label>
                  ))}
                </Flex>
              </Split>
            </MenuItem>
          ))}
        </DrilldownMenu>
      }
    >
      {n_(
        "Select another disk to define partitions",
        "Select a disk to define partitions",
        drivesCount,
      )}
    </MenuItem>
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
export default function AddExistingDeviceMenu() {
  const navigate = useNavigate();
  const model = useConfigModel({ suspense: true });
  const { addDrive } = useModel();
  const allDevices = useAvailableDevices();
  const menuRef = useRef();
  const toggleRef = useRef();
  const [isOpen, setIsOpen] = useState(false);
  const [menuDrilledIn, setMenuDrilledIn] = React.useState<string[]>([]);
  const [drilldownPath, setDrilldownPath] = React.useState<string[]>([]);
  const [activeMenu, setActiveMenu] = React.useState<string>("root");
  const [menuHeights, setMenuHeights] = React.useState({});

  const resetState = () => {
    setMenuDrilledIn([]);
    setDrilldownPath([]);
    setActiveMenu("root");
  };

  const toggle = () => {
    setIsOpen(!isOpen);
    resetState();
  };

  const addDriveAndClose = (driveName) => {
    addDrive(driveName);
    setIsOpen(false);
    resetState();
  };

  const drivesNames = model.drives.map((d) => d.name);
  const drivesCount = drivesNames.length;
  const devices = allDevices.filter((d) => !drivesNames.includes(d.name));

  const drillIn = (
    _: React.KeyboardEvent | React.MouseEvent,
    fromMenuId: string,
    toMenuId: string,
    pathId: string,
  ) => {
    setMenuDrilledIn([...menuDrilledIn, fromMenuId]);
    setDrilldownPath([...drilldownPath, pathId]);
    setActiveMenu(toMenuId);
  };

  const drillOut = (_: React.KeyboardEvent | React.MouseEvent, toMenuId: string) => {
    const menuDrilledInSansLast = menuDrilledIn.slice(0, menuDrilledIn.length - 1);
    const pathSansLast = drilldownPath.slice(0, drilldownPath.length - 1);
    setMenuDrilledIn(menuDrilledInSansLast);
    setDrilldownPath(pathSansLast);
    setActiveMenu(toMenuId);
  };

  const setHeight = (menuId: string, height: number) => {
    // FIXME: look for a better way to avoid test crashing because of this
    // method
    if (process.env.NODE_ENV === "test") return;

    if (
      menuHeights[menuId] === undefined ||
      (menuId !== "root" && menuHeights[menuId] !== height)
    ) {
      setMenuHeights({ ...menuHeights, [menuId]: height });
    }
  };

  return (
    <MenuContainer
      isOpen={isOpen}
      onOpenChange={toggle}
      toggleRef={toggleRef}
      toggle={
        <MenuToggle ref={toggleRef} onClick={toggle} isExpanded={isOpen}>
          {_("Configure a device")}
        </MenuToggle>
      }
      menuRef={menuRef}
      menu={
        <Menu
          id="root"
          containsDrilldown
          onDrillIn={drillIn}
          onDrillOut={drillOut}
          onGetMenuHeight={setHeight}
          activeMenu={activeMenu}
          drilledInMenus={menuDrilledIn}
          drilldownItemPath={drilldownPath}
          ref={menuRef}
        >
          <MenuContent menuHeight={`${menuHeights[activeMenu]}px`}>
            <MenuList>
              <DisksDrillDownMenuItem
                drivesCount={drivesCount}
                devices={devices}
                onDeviceClick={addDriveAndClose}
              />
              <Divider />
              <MenuItem
                key="lvm-link"
                onClick={() => navigate(PATHS.volumeGroup.add)}
                description={_("Extend the installation using LVM")}
              >
                {_("Add LVM volume group")}
              </MenuItem>
            </MenuList>
          </MenuContent>
        </Menu>
      }
    />
  );
}
