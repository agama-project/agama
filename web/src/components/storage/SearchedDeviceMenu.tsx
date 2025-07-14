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
import MenuButton, { MenuButtonItem } from "~/components/core/MenuButton";
import NewVgMenuOption from "./NewVgMenuOption";
import { useAvailableDevices } from "~/hooks/storage/system";
import { useModel } from "~/hooks/storage/model";
import { useSwitchToDrive } from "~/hooks/storage/drive";
import { useSwitchToMdRaid } from "~/hooks/storage/md-raid";
import { deviceBaseName, formattedPath } from "~/components/storage/utils";
import * as model from "~/types/storage/model";
import { StorageDevice } from "~/types/storage";
import { sprintf } from "sprintf-js";
import { _, formatList } from "~/i18n";
import DeviceSelectorModal from "./DeviceSelectorModal";
import { MenuItemProps } from "@patternfly/react-core";
import { Icon } from "../layout";

const baseName = (device: StorageDevice): string => deviceBaseName(device, true);

const UseOnlyOneOption = (device: model.Drive | model.MdRaid): boolean => {
  const hasPv = device.isTargetDevice;
  if (!device.getMountPaths().length && (hasPv || device.isExplicitBoot)) return true;

  return device.isReusingPartitions;
};

type ChangeDeviceMenuItemProps = {
  modelDevice: model.Drive | model.MdRaid;
  device: StorageDevice;
} & MenuItemProps;

const ChangeDeviceTitle = ({ modelDevice }) => {
  const onlyOneOption = UseOnlyOneOption(modelDevice);
  const mountPaths = modelDevice.getMountPaths();
  const hasMountPaths = mountPaths.length > 0;

  if (onlyOneOption) {
    return _("Selected disk cannot be changed");
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

const ChangeDeviceDescription = ({ modelDevice, device }) => {
  const name = baseName(device);
  const volumeGroups = modelDevice.getVolumeGroups() || [];
  const isBoot = modelDevice.isBoot;
  const isExplicitBoot = modelDevice.isExplicitBoot;
  const mountPaths = modelDevice.getMountPaths();
  const hasMountPaths = mountPaths.length > 0;
  const hasPv = volumeGroups.length > 0;
  const vgName = volumeGroups[0]?.vgName;

  if (modelDevice.isReusingPartitions) {
    // The current device will be the only option to choose from
    return _("This uses existing partitions at the disk");
  }

  if (!hasMountPaths) {
    // The current device will be the only option to choose from
    if (hasPv) {
      if (volumeGroups.length > 1) {
        if (isExplicitBoot) {
          return _("It is chosen for booting and for some LVM groups");
        }
        return _("It is chosen for some LVM groups");
      }
      if (isExplicitBoot) {
        return sprintf(
          // TRANSLATORS: %s is the name of the LVM
          _("It is chosen for booting and for the LVM group '%s'"),
          vgName,
        );
      }

      // TRANSLATORS: %s is the name of the LVM
      return sprintf(_("It is chosen for the LVM group '%s'"), vgName);
    }

    // The current device will be the only option to choose from
    if (isExplicitBoot) {
      return _("It is chosen for booting");
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

/**
 * Internal component holding the logic for rendering the disks drilldown menu
 */
const ChangeDeviceMenuItem = ({
  modelDevice,
  device,
  ...props
}: ChangeDeviceMenuItemProps): React.ReactNode => {
  const onlyOneOption = UseOnlyOneOption(modelDevice);

  return (
    <MenuButtonItem
      aria-label={_("Change device menu")}
      description={<ChangeDeviceDescription modelDevice={modelDevice} device={device} />}
      isDisabled={onlyOneOption}
      {...props}
    >
      <ChangeDeviceTitle modelDevice={modelDevice} />
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
  const hasAdditionalDrives = (model: model.Model): boolean => {
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

  // If these cases, the target device cannot be changed and this disabled button would only provide
  // information that is redundant to the one already displayed at the disabled "change device" one.
  if (!device.getMountPaths().length && (hasPv || isExplicitBoot)) return;

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
  const [isSelectorOpen, setIsSelectorOpen] = useState(false);
  const switchToDrive = useSwitchToDrive();
  const switchToMdRaid = useSwitchToMdRaid();
  const changeTargetFn = (device: StorageDevice) => {
    const hook = device.isDrive ? switchToDrive : switchToMdRaid;
    hook(modelDevice.name, { name: device.name });
  };
  const devices = useAvailableDevices();

  const onDeviceChange = ([drive]: StorageDevice[]) => {
    setIsSelectorOpen(false);
    changeTargetFn(drive);
  };

  return (
    <>
      <MenuButton
        menuProps={{
          "aria-label": sprintf(_("Device %s menu"), modelDevice.name),
          popperProps: { position: "end" },
        }}
        toggleProps={{
          variant: "plain",
        }}
        items={[
          <ChangeDeviceMenuItem
            key="change"
            modelDevice={modelDevice}
            device={selected}
            onClick={() => setIsSelectorOpen(true)}
          />,
          <NewVgMenuOption key="add-vg-option" device={modelDevice} />,
          <RemoveEntryOption key="delete-disk-option" device={modelDevice} onClick={deleteFn} />,
        ]}
      >
        <span className="action-text">{_("Change")}</span>{" "}
        <Icon name="more_horiz" className="agm-strong-icon" />
      </MenuButton>
      {isSelectorOpen && (
        <DeviceSelectorModal
          title={<ChangeDeviceTitle modelDevice={modelDevice} />}
          description={<ChangeDeviceDescription modelDevice={modelDevice} device={selected} />}
          selected={selected}
          devices={devices}
          onConfirm={onDeviceChange}
          onCancel={() => setIsSelectorOpen(false)}
        />
      )}
    </>
  );
}
