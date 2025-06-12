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
import { useCandidateDevices, useLongestDiskTitle } from "~/hooks/storage/system";
import { useModel } from "~/hooks/storage/model";
import { useSwitchToDrive } from "~/hooks/storage/drive";
import { useSwitchToMdRaid } from "~/hooks/storage/md-raid";
import { deviceBaseName, deviceLabel, formattedPath } from "~/components/storage/utils";
import * as model from "~/types/storage/model";
import { StorageDevice } from "~/types/storage";
import { sprintf } from "sprintf-js";
import { _, formatList } from "~/i18n";

const baseName = (device: StorageDevice): string => deviceBaseName(device, true);
const label = (device: StorageDevice): string => deviceLabel(device, true);

const UseOnlyOneOption = (device: model.Drive | model.MdRaid): boolean => {
  const hasPv = device.isTargetDevice;
  if (!device.getMountPaths().length && (hasPv || device.isExplicitBoot)) return true;

  return device.isReusingPartitions;
};

type DiskSelectorTitleProps = { device: StorageDevice; isSelected: boolean };

const DiskSelectorTitle = ({
  device,
  isSelected = false,
}: DiskSelectorTitleProps): React.ReactNode => {
  const Name = () => (isSelected ? <b>{label(device)}</b> : label(device));
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
  onChange: (device: StorageDevice) => void,
): React.ReactNode[] => {
  return devices.map((device) => {
    const isSelected = device.sid === selected.sid;

    return (
      <MenuButtonItem
        key={device.sid}
        itemId={device.sid}
        isSelected={isSelected}
        description={<MenuDeviceDescription device={device} />}
        onClick={() => onChange(device)}
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
  modelDevice: model.Drive | model.mdRaid,
  devices: StorageDevice[],
  selected: StorageDevice,
  onChange: (device: StorageDevice) => void,
): React.ReactNode[] => {
  const onlyOneOption = UseOnlyOneOption(modelDevice);

  if (onlyOneOption) return [<SearchSelectorSingleOption key="disk-option" selected={selected} />];

  return searchSelectorMultipleOptions(devices, selected, onChange);
};

type DisksDrillDownMenuItemProps = {
  modelDevice: model.Drive | model.mdRaid;
  selected: StorageDevice;
  onDeviceClick: (device: StorageDevice) => void;
};

/**
 * Internal component holding the logic for rendering the disks drilldown menu
 */
const DisksDrillDownMenuItem = ({
  modelDevice,
  selected,
  onDeviceClick,
}: DisksDrillDownMenuItemProps): React.ReactNode => {
  const volumeGroups = modelDevice.getVolumeGroups() || [];
  const onlyOneOption = UseOnlyOneOption(modelDevice);
  const devices = useCandidateDevices();

  const isBoot = modelDevice.isBoot;
  const isExplicitBoot = modelDevice.isExplicitBoot;
  const mountPaths = modelDevice.getMountPaths();
  const hasMountPaths = mountPaths.length > 0;
  const hasPv = volumeGroups.length > 0;
  const vgName = volumeGroups[0]?.vgName;

  const mainText = (): string => {
    if (onlyOneOption) {
      return _("Selected disk (cannot be changed)");
    }

    if (!hasMountPaths) {
      return _("Select a disk to configure");
    }

    if (mountPaths.includes("/")) {
      return _("Select a disk to install the system");
    }

    const newMountPaths = modelDevice.partitions
      .filter((p) => !p.name)
      .map((p) => formattedPath(p.mountPath));

    return sprintf(
      // TRANSLATORS: %s is a list of formatted mount points like '"/", "/var" and "swap"' (or a
      // single mount point in the singular case).
      _("Select a disk to create %s"),
      formatList(newMountPaths),
    );
  };

  const extraText = (): string => {
    const name = baseName(selected);

    if (modelDevice.isReusingPartitions) {
      // The current device will be the only option to choose from
      return _("This uses existing partitions at the disk");
    }

    if (!hasMountPaths) {
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
      items={searchSelectorOptions(modelDevice, devices, selected, onDeviceClick)}
    >
      {text}
    </MenuButtonItem>
  );
};

type RemoveEntryOptionProps = {
  device: model.Drive | model.MdRaid;
  onClick: (device: model.Drive | model.MdRaid) => void;
};

const RemoveEntryOption = ({ device, onClick }: RemoveEntryOptionProps): React.ReactNode => {
  const model = useModel();

  /*
   * Pretty artificial logic used to decide whether the UI should display buttons to remove
   * some drives.
   */
  const hasAdditionalDrives = (model: model.Config): boolean => {
    const entries = model.drives.concat(model.mdRaids);

    if (entries.length <= 1) return false;
    if (entries.length > 2) return true;

    // If there are only two drives, the following logic avoids the corner case in which first
    // deleting one of them and then changing the boot settings can lead to zero disks. But it is far
    // from being fully reasonable or understandable for the user.
    const onlyToBoot = entries.find((e) => e.isExplicitBoot && !e.isUsed);
    return !onlyToBoot;
  };

  // When no additional drives has been added, the "Do not use" button can be confusing so it is
  // omitted for all drives.
  if (!hasAdditionalDrives(model)) return;

  let description;
  const isExplicitBoot = device.isExplicitBoot;
  const hasPv = device.isTargetDevice;
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
      onClick={() => onClick(device)}
    >
      {_("Do not use")}
    </MenuButtonItem>
  );
};

export type SearchedDeviceMenuProps = {
  modelDevice: model.Drive | model.MdRaid;
  selected: StorageDevice;
  deleteFn: (device: model.Drive | model.MdRaid) => void;
};

/**
 * Menu that provides options for users to configure the device used by a configuration
 * entry that represents a partitionable previously existing in the system (a drive or a
 * reused software RAID).
 */
export default function SearchedDeviceMenu({
  modelDevice,
  selected,
  deleteFn,
}: SearchedDeviceMenuProps): React.ReactNode {
  const switchToDrive = useSwitchToDrive();
  const switchToMdRaid = useSwitchToMdRaid();
  const changeTargetFn = (device: StorageDevice) => {
    const hook = device.isDrive ? switchToDrive : switchToMdRaid;
    hook(modelDevice.name, { name: device.name });
  };
  const longestTitle = useLongestDiskTitle();

  return (
    <MenuButton
      menuProps={{
        "aria-label": sprintf(_("Device %s menu"), modelDevice.name),
        popperProps: { minWidth: `min(${longestTitle * 0.75}em, 75vw)`, width: "max-content" },
      }}
      toggleProps={{
        className: "agm-inline-toggle",
      }}
      items={[
        <DisksDrillDownMenuItem
          key="change-disk-option"
          modelDevice={modelDevice}
          selected={selected}
          onDeviceClick={changeTargetFn}
        />,
        <NewVgMenuOption key="add-vg-option" device={modelDevice} />,
        <RemoveEntryOption key="delete-disk-option" device={modelDevice} onClick={deleteFn} />,
      ]}
    >
      {<b>{label(selected)}</b>}
    </MenuButton>
  );
}
