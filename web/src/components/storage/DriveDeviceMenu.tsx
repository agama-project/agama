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
import { Split, Flex, Label } from "@patternfly/react-core";
import MenuButton, { MenuButtonItem } from "~/components/core/MenuButton";
import MenuDeviceDescription from "./MenuDeviceDescription";
import NewVgMenuOption from "./NewVgMenuOption";
import { useAvailableDrives, useLongestDiskTitle } from "~/hooks/storage/system";
import { useDrive, useModel } from "~/queries/storage/config-model";
import { useDrive as useDriveModel } from "~/hooks/storage/drive";
import * as driveUtils from "~/components/storage/utils/drive";
import { deviceBaseName, deviceLabel, formattedPath } from "~/components/storage/utils";
import * as model from "~/types/storage/model";
import { StorageDevice } from "~/types/storage";
import { sprintf } from "sprintf-js";
import { _, formatList } from "~/i18n";

const driveBaseName = (device: StorageDevice): string => deviceBaseName(device, true);
const driveLabel = (device: StorageDevice): string => deviceLabel(device, true);

const UseOnlyOneOption = (drive: model.Drive): boolean => {
  const driveModel = useDrive(drive.name);
  if (!driveModel) return false;

  const { isExplicitBoot, hasPv } = driveModel;
  if (!driveUtils.hasFilesystem(drive) && (hasPv || isExplicitBoot)) return true;

  return driveUtils.hasReuse(drive);
};

type DiskSelectorTitleProps = { device: StorageDevice; isSelected: boolean };

const DiskSelectorTitle = ({
  device,
  isSelected = false,
}: DiskSelectorTitleProps): React.ReactNode => {
  const Name = () => (isSelected ? <b>{driveLabel(device)}</b> : driveLabel(device));
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

const searchSelectorMultipleOptions = (
  devices: StorageDevice[],
  selected: StorageDevice,
  onChange: (name: StorageDevice["name"]) => void,
): React.ReactNode[] => {
  return devices.map((device) => {
    const isSelected = device.sid === selected.sid;

    return (
      <MenuButtonItem
        key={device.sid}
        itemId={device.sid}
        isSelected={isSelected}
        description={<MenuDeviceDescription device={device} />}
        onClick={() => onChange(device.name)}
      >
        <DiskSelectorTitle device={device} isSelected={isSelected} />
      </MenuButtonItem>
    );
  });
};

const SearchSelectorSingleOption = ({ selected }: { selected: StorageDevice }): React.ReactNode => {
  return (
    <MenuButtonItem
      isSelected
      key={selected.sid}
      itemId={selected.sid}
      description={<MenuDeviceDescription device={selected} />}
    >
      <DiskSelectorTitle device={selected} isSelected />
    </MenuButtonItem>
  );
};

const searchSelectorOptions = (
  drive: model.Drive,
  devices: StorageDevice[],
  selected: StorageDevice,
  onChange: (name: StorageDevice["name"]) => void,
): React.ReactNode[] => {
  const onlyOneOption = UseOnlyOneOption(drive);

  if (onlyOneOption) return [<SearchSelectorSingleOption key="disk-option" selected={selected} />];

  return searchSelectorMultipleOptions(devices, selected, onChange);
};

type DisksDrillDownMenuItemProps = {
  drive: model.Drive;
  selected: StorageDevice;
  onDeviceClick: (name: StorageDevice["name"]) => void;
};

/**
 * Internal component holding the logic for rendering the disks drilldown menu
 */
const DisksDrillDownMenuItem = ({
  drive,
  selected,
  onDeviceClick,
}: DisksDrillDownMenuItemProps): React.ReactNode => {
  /** @todo Replace the useDrive hook from /queries by the hook from /hooks. */
  const volumeGroups = useDriveModel(drive.name)?.getVolumeGroups() || [];
  const onlyOneOption = UseOnlyOneOption(drive);
  const devices = useAvailableDrives();
  const driveModel = useDrive(drive.name);
  if (!driveModel) return;

  const { isBoot, isExplicitBoot, hasPv } = driveModel;
  const vgName = volumeGroups[0]?.vgName;

  const mainText = (): string => {
    if (onlyOneOption) {
      return _("Selected disk (cannot be changed)");
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
    const name = driveBaseName(selected);

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

  const text = mainText();

  return (
    <MenuButtonItem
      aria-label={_("Change device menu")}
      description={extraText()}
      items={searchSelectorOptions(drive, devices, selected, onDeviceClick)}
    >
      {text}
    </MenuButtonItem>
  );
};

type RemoveDriveOptionProps = { drive: model.Drive };

const RemoveDriveOption = ({ drive }: RemoveDriveOptionProps): React.ReactNode => {
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
    <MenuButtonItem
      key="delete"
      isDanger
      isDisabled={isDisabled}
      description={description}
      onClick={deleteDrive}
    >
      {_("Do not use")}
    </MenuButtonItem>
  );
};

export type DriveDeviceMenuProps = { drive: model.Drive; selected: StorageDevice };

/**
 * Menu that provides options for users to configure the device used by a given drive.
 *
 * It uses a drilled-down menu approach for disks, making the available options less
 * overwhelming by presenting them in a more organized manner.
 */
export default function DriveDeviceMenu({
  drive,
  selected,
}: DriveDeviceMenuProps): React.ReactNode {
  const driveHandler = useDrive(drive.name);
  const changeDriveTarget = (newDriveName: string) => {
    driveHandler.switch(newDriveName);
  };
  const longestTitle = useLongestDiskTitle();

  return (
    <MenuButton
      menuProps={{
        "aria-label": sprintf(_("Device %s menu"), drive.name),
        popperProps: { minWidth: `min(${longestTitle * 0.75}em, 75vw)`, width: "max-content" },
      }}
      toggleProps={{
        className: "agm-inline-toggle",
      }}
      items={[
        <DisksDrillDownMenuItem
          key="change-disk-option"
          drive={drive}
          selected={selected}
          onDeviceClick={changeDriveTarget}
        />,
        <NewVgMenuOption key="add-vg-option" device={drive} />,
        <RemoveDriveOption key="delete-disk-option" drive={drive} />,
      ]}
    >
      {<b>{driveLabel(selected)}</b>}
    </MenuButton>
  );
}
