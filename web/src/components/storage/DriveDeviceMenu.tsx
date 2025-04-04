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
import { useDrive, useModel } from "~/queries/storage/config-model";
import { useDrive as useDriveModel } from "~/hooks/storage/drive";
import { useModel as useModelHook } from "~/hooks/storage/model";
import { useConvertToVolumeGroup } from "~/hooks/storage/volume-group";
import * as driveUtils from "~/components/storage/utils/drive";
import { deviceBaseName, deviceLabel, formattedPath } from "~/components/storage/utils";
import { sprintf } from "sprintf-js";
import { _, n_, formatList } from "~/i18n";

const UseOnlyOneOption = (drive) => {
  const driveModel = useDrive(drive.name);
  if (!driveModel) return false;

  const { isExplicitBoot, hasPv } = driveModel;
  if (!driveUtils.hasFilesystem(drive) && (hasPv || isExplicitBoot)) return true;

  return driveUtils.hasReuse(drive);
};

const DiskSelectorTitle = ({ device, isSelected = false }) => {
  const Name = () => (isSelected ? <b>{deviceLabel(device)}</b> : deviceLabel(device));
  const Systems = () => (
    <Flex columnGap={{ default: "columnGapXs" }}>
      {device.systems.map((s, i) => (
        <Label key={i} isCompact>
          {s}
        </Label>
      ))}
    </Flex>
  );

  return (
    <Split hasGutter>
      <Name />
      <Systems />
    </Split>
  );
};

const SearchSelectorMultipleOptions = ({ selected, onChange }) => {
  const devices = useAvailableDevices();

  return (
    <>
      {devices.map((device) => {
        const isSelected = device.sid === selected.sid;

        return (
          <MenuItem
            key={device.sid}
            itemId={device.sid}
            isSelected={isSelected}
            description={<MenuDeviceDescription device={device} />}
            onClick={() => onChange(device.name)}
          >
            <DiskSelectorTitle device={device} isSelected={isSelected} />
          </MenuItem>
        );
      })}
    </>
  );
};

const SearchSelectorSingleOption = ({ selected }) => {
  return (
    <MenuItem
      isSelected
      key={selected.sid}
      itemId={selected.sid}
      description={<MenuDeviceDescription device={selected} />}
    >
      <DiskSelectorTitle device={selected} isSelected />
    </MenuItem>
  );
};

const SearchSelectorOptions = ({ drive, selected, onChange }) => {
  const onlyOneOption = UseOnlyOneOption(drive);

  if (onlyOneOption) return <SearchSelectorSingleOption selected={selected} />;

  return <SearchSelectorMultipleOptions selected={selected} onChange={onChange} />;
};

/**
 * Internal component holding the logic for rendering the disks drilldown menu
 */
const DisksDrillDownMenuItem = ({ drive, selected, onDeviceClick }) => {
  /** @todo Replace the useDrive hook from /queries by the hook from /hooks. */
  const volumeGroups = useDriveModel(drive.name)?.getVolumeGroups() || [];
  const onlyOneOption = UseOnlyOneOption(drive);
  const driveModel = useDrive(drive.name);
  if (!driveModel) return;

  const { isBoot, isExplicitBoot, hasPv } = driveModel;
  const vgName = volumeGroups[0]?.vgName;

  const mainText = (): string => {
    if (onlyOneOption) {
      return _("Selected disk");
    }

    if (!driveUtils.hasFilesystem(drive)) {
      return _("Select a disk to configure");
    }

    if (driveUtils.hasRoot(drive)) {
      return _("Select a disk to install the system");
    }

    const mountPaths = drive.partitions
      .filter((p) => !p.name)
      .map((p) => formattedPath(p.mountPath));

    return sprintf(
      // TRANSLATORS: %s is a list of formatted mount points like '"/", "/var" and "swap"' (or a
      // single mount point in the singular case).
      _("Select a disk to create %s"),
      formatList(mountPaths),
    );
  };

  const extraText = (): string => {
    const name = deviceBaseName(drive, 20);

    if (driveUtils.hasReuse(drive)) {
      // The current device will be the only option to choose from
      return _("This uses existing partitions at the disk");
    }

    if (!driveUtils.hasFilesystem(drive)) {
      // The current device will be the only option to choose from
      if (hasPv) {
        if (volumeGroups.length > 1) {
          if (isExplicitBoot) {
            return _(
              "This disk will contain the configured LVM groups and any partition needed to boot",
            );
          }
          return _("This disk will contain the configured LVM groups");
        }
        if (isExplicitBoot) {
          return sprintf(
            // TRANSLATORS: %s is the name of the LVM
            _("This disk will contain the LVM group '%s' and any partition needed to boot"),
            vgName,
          );
        }

        // TRANSLATORS: %s is the name of the LVM
        return sprintf(_("This disk will contain the LVM group '%s'"), vgName);
      }

      // The current device will be the only option to choose from
      if (isExplicitBoot) {
        return _("This disk will contain any partition needed for booting");
      }
    }

    if (hasPv) {
      if (volumeGroups.length > 1) {
        if (isExplicitBoot) {
          return sprintf(
            // TRANSLATORS: %s is the name of the disk (eg. sda)
            _("%s will still contain the configured LVM groups and any partition needed to boot"),
            name,
          );
        }

        // TRANSLATORS: %s is the name of the disk (eg. sda)
        return sprintf(_("The configured LVM groups will remain at %s"), name);
      }

      if (isExplicitBoot) {
        return sprintf(
          // TRANSLATORS: %1$s is the name of the disk (eg. sda) and %2$s the name of the LVM
          _("%1$s will still contain the LVM group '%2$s' and any partition needed to boot"),
          name,
          vgName,
        );
      }

      return sprintf(
        // TRANSLATORS: %1$s is the name of the LVM and %2$s the name of the disk (eg. sda)
        _("The LVM group '%1$s' will remain at %2$s"),
        vgName,
        name,
      );
    }

    if (isExplicitBoot) {
      // TRANSLATORS: %s is the name of the disk (eg. sda)
      return sprintf(_("Partitions needed for booting will remain at %s"), name);
    }

    if (isBoot) {
      return _("Partitions needed for booting will also be adapted");
    }
  };

  return (
    <MenuItem
      itemId="group:disks-menu"
      direction="down"
      description={extraText()}
      drilldownMenu={
        <DrilldownMenu id="disks-menu">
          <MenuItem itemId="group:disks-menu-back" direction="up">
            {_("Back")}
          </MenuItem>
          <Divider />
          <SearchSelectorOptions drive={drive} selected={selected} onChange={onDeviceClick} />
        </DrilldownMenu>
      }
    >
      {mainText()}
    </MenuItem>
  );
};

const RemoveDriveOption = ({ drive }) => {
  const driveModel = useDrive(drive.name);
  const { hasAdditionalDrives } = useModel();

  if (!driveModel) return;

  const { isExplicitBoot, hasPv, delete: deleteDrive } = driveModel;

  // When no additional drives has been added, the "Do not use" button can be confusing so it is
  // omitted for all drives.
  if (!hasAdditionalDrives) return;

  let description;
  const isDisabled = isExplicitBoot || hasPv;

  if (isExplicitBoot) {
    if (hasPv) {
      description = _("The disk is used for LVM and boot");
    } else {
      description = _("The disk is used for booting");
    }
  } else {
    if (hasPv) {
      description = _("The disk is used for LVM");
    } else {
      description = _("Remove the configuration for this disk");
    }
  }

  return (
    <MenuItem
      key="delete"
      isDanger
      isDisabled={isDisabled}
      description={description}
      onClick={deleteDrive}
    >
      {_("Do not use")}
    </MenuItem>
  );
};

const NewVgOption = ({ drive }) => {
  const convertToVg = useConvertToVolumeGroup();
  const model = useModelHook();
  const vgs = model.volumeGroups.filter((vg) => vg.targetDevices.includes(drive.name));
  const mountPaths = drive.partitions.filter((p) => !p.name).map((p) => formattedPath(p.mountPath));

  const titleText = () => {
    if (vgs.length) {
      // TRANSLATORS: %s is the short name of a disk, like 'sda'
      return sprintf(_("Create another LVM volume group on %s"), deviceBaseName(drive, 20));
    }

    // TRANSLATORS: %s is the short name of a disk, like 'sda'
    return sprintf(_("Create LVM volume group on %s"), deviceBaseName(drive, 20));
  };

  const descriptionText = () => {
    if (mountPaths.length) {
      return sprintf(
        n_(
          // TRANSLATORS: %s is a list of formatted mount points like '"/", "/var" and "swap"' (or a
          // single mount point in the singular case).
          "%s will be created as a logical volume",
          "%s will be created as logical volumes",
          mountPaths.length,
        ),
        formatList(mountPaths),
      );
    }
  };

  return (
    <MenuItem
      component="a"
      onClick={() => convertToVg(drive.name)}
      itemId="lvm"
      description={descriptionText()}
    >
      <Flex component="span" justifyContent={{ default: "justifyContentSpaceBetween" }}>
        <span>{titleText()}</span>
      </Flex>
    </MenuItem>
  );
};

/**
 * Menu that provides options for users to configure the device used by a given drive.
 *
 * It uses a drilled-down menu approach for disks, making the available options less
 * overwhelming by presenting them in a more organized manner.
 */
export default function DriveDeviceMenu({ drive, selected }) {
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

  const driveHandler = useDrive(drive.name);
  const changeDriveTarget = (newDriveName: string) => {
    driveHandler.switch(newDriveName);
    setIsOpen(false);
    resetState();
  };

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
    // FIXME: look for a better way to avoid test crashing because of this method
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
          <b aria-hidden>{deviceLabel(selected, 20)}</b>
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
          onSelect={(_e, id) => {
            if (!String(id).startsWith("group:disks-menu")) setIsOpen(false);
          }}
        >
          <MenuContent menuHeight={`${menuHeights[activeMenu]}px`}>
            <MenuList>
              <DisksDrillDownMenuItem
                drive={drive}
                selected={selected}
                onDeviceClick={changeDriveTarget}
              />
              <NewVgOption drive={drive} />
              <RemoveDriveOption drive={drive} />
            </MenuList>
          </MenuContent>
        </Menu>
      }
    />
  );
}
