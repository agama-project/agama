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
import MenuButton, { CustomToggleProps, MenuButtonItem } from "~/components/core/MenuButton";
import NewVgMenuOption from "./NewVgMenuOption";
import { useAvailableDevices } from "~/hooks/model/system/storage";
import { useConfigModel } from "~/hooks/model/storage/config-model";
import { useAddFromMdRaid } from "~/hooks/storage/drive";
import { useAddFromDrive } from "~/hooks/storage/md-raid";
import { deviceBaseName, formattedPath } from "~/components/storage/utils";
import configModel from "~/model/storage/config-model";
import { sprintf } from "sprintf-js";
import { _, formatList } from "~/i18n";
import DeviceSelectorModal from "./DeviceSelectorModal";
import { MenuItemProps } from "@patternfly/react-core";
import { isDrive } from "~/model/storage/device";
import type { Storage } from "~/model/system";
import type { ConfigModel } from "~/model/storage/config-model";

const baseName = (device: Storage.Device): string => deviceBaseName(device, true);

const useOnlyOneOption = (
  config: ConfigModel.Config,
  device: ConfigModel.Drive | ConfigModel.MdRaid,
): boolean => {
  if (device.filesystem && device.filesystem.reuse) return true;

  const isTargetDevice = configModel.isTargetDevice(config, device.name);

  if (
    !configModel.partitionable.usedMountPaths(device).length &&
    (isTargetDevice || configModel.boot.hasExplicitDevice(config, device.name))
  )
    return true;

  return configModel.partitionable.isReusingPartitions(device);
};

type ChangeDeviceTitleProps = {
  modelDevice: ConfigModel.Drive | ConfigModel.MdRaid;
};

const ChangeDeviceTitle = ({ modelDevice }: ChangeDeviceTitleProps) => {
  const config = useConfigModel();
  const onlyOneOption = useOnlyOneOption(config, modelDevice);
  if (onlyOneOption) {
    return _("Selected disk cannot be changed");
  }

  if (modelDevice.filesystem) {
    // TRANSLATORS: %s is a formatted mount point like '"/home"'
    return sprintf(_("Change the disk to format as %s"), formattedPath(modelDevice.mountPath));
  }

  const mountPaths = configModel.partitionable.usedMountPaths(modelDevice);
  const hasMountPaths = mountPaths.length > 0;

  if (!hasMountPaths) {
    return _("Change the disk to configure");
  }

  if (mountPaths.includes("/")) {
    return _("Change the disk to install the system");
  }

  const newMountPaths = modelDevice.partitions
    .filter((p) => !p.name)
    .map((p) => formattedPath(p.mountPath));

  return sprintf(
    // TRANSLATORS: %s is a list of formatted mount points like '"/", "/var" and "swap"' (or a
    // single mount point in the singular case).
    _("Change the disk to create %s"),
    formatList(newMountPaths),
  );
};

type ChangeDeviceDescriptionProps = {
  modelDevice: ConfigModel.Drive | ConfigModel.MdRaid;
  device: Storage.Device;
};

const ChangeDeviceDescription = ({ modelDevice, device }: ChangeDeviceDescriptionProps) => {
  const config = useConfigModel();
  const name = baseName(device);
  const volumeGroups = configModel.partitionable.filterVolumeGroups(config, modelDevice);
  const isExplicitBoot = configModel.boot.hasExplicitDevice(config, modelDevice.name);
  const isBoot = configModel.boot.hasDevice(config, modelDevice.name);
  const mountPaths = configModel.partitionable.usedMountPaths(modelDevice);
  const isReusingPartitions = configModel.partitionable.isReusingPartitions(modelDevice);
  const hasMountPaths = mountPaths.length > 0;
  const hasPv = volumeGroups.length > 0;
  const vgName = volumeGroups[0]?.vgName;

  if (modelDevice.filesystem && modelDevice.filesystem.reuse)
    return _("This uses the existing file system at the disk");

  if (isReusingPartitions) {
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

type ChangeDeviceMenuItemProps = {
  modelDevice: ConfigModel.Drive | ConfigModel.MdRaid;
  device: Storage.Device;
} & MenuItemProps;

/**
 * Internal component holding the presentation of the option to change the device
 */
const ChangeDeviceMenuItem = ({
  modelDevice,
  device,
  ...props
}: ChangeDeviceMenuItemProps): React.ReactNode => {
  const config = useConfigModel();
  const onlyOneOption = useOnlyOneOption(config, modelDevice);

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
  device: ConfigModel.Drive | ConfigModel.MdRaid;
  onClick: (device: ConfigModel.Drive | ConfigModel.MdRaid) => void;
};

const RemoveEntryOption = ({ device, onClick }: RemoveEntryOptionProps): React.ReactNode => {
  const config = useConfigModel();

  /*
   * Pretty artificial logic used to decide whether the UI should display buttons to remove
   * some drives.
   */
  const hasAdditionalDrives = (config: ConfigModel.Config): boolean => {
    const entries = config.drives.concat(config.mdRaids);

    if (entries.length <= 1) return false;
    if (entries.length > 2) return true;

    // If there are only two drives, the following logic avoids the corner case in which first
    // deleting one of them and then changing the boot settings can lead to zero disks. But it is far
    // from being fully reasonable or understandable for the user.
    const onlyToBoot = entries.find(
      (e) =>
        configModel.boot.hasExplicitDevice(config, e.name) &&
        !configModel.partitionable.isUsed(config, e.name),
    );
    return !onlyToBoot;
  };

  // When no additional drives has been added, the "Do not use" button can be confusing so it is
  // omitted for all drives.
  if (!hasAdditionalDrives(config)) return;

  let description;
  const isExplicitBoot = configModel.boot.hasExplicitDevice(config, device.name);
  const hasPv = configModel.isTargetDevice(config, device.name);
  const isDisabled = isExplicitBoot || hasPv;

  // If these cases, the target device cannot be changed and this disabled button would only provide
  // information that is redundant to the one already displayed at the disabled "change device" one.
  if (!configModel.partitionable.usedMountPaths(device).length && (hasPv || isExplicitBoot)) return;

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

const targetDevices = (
  modelDevice: ConfigModel.Drive | ConfigModel.MdRaid,
  config: ConfigModel.Config,
  availableDevices: Storage.Device[],
): Storage.Device[] => {
  return availableDevices.filter((availableDev) => {
    if (modelDevice.name === availableDev.name) return true;

    const collection = isDrive(availableDev) ? config.drives : config.mdRaids;
    const device = collection.find((d) => d.name === availableDev.name);
    if (!device) return true;

    if (modelDevice.filesystem) return !configModel.partitionable.isUsed(config, device.name);

    return !device.filesystem;
  });
};

export type SearchedDeviceMenuProps = {
  selected: Storage.Device;
  modelDevice: ConfigModel.Drive | ConfigModel.MdRaid;
  toggle?: React.ReactElement<CustomToggleProps>;
  deleteFn: (device: ConfigModel.Drive | ConfigModel.MdRaid) => void;
};

/**
 * Menu that provides options for users to configure the device used by a configuration
 * entry that represents a partitionable previously existing in the system (a drive or a
 * reused software RAID).
 */
export default function SearchedDeviceMenu({
  modelDevice,
  selected,
  toggle,
  deleteFn,
}: SearchedDeviceMenuProps): React.ReactNode {
  const [isSelectorOpen, setIsSelectorOpen] = useState(false);
  const switchToDrive = useAddFromMdRaid();
  const switchToMdRaid = useAddFromDrive();
  const changeTargetFn = (device: Storage.Device) => {
    const hook = isDrive(device) ? switchToDrive : switchToMdRaid;
    hook(modelDevice.name, { name: device.name });
  };
  const devices = targetDevices(modelDevice, useConfigModel(), useAvailableDevices());

  const onDeviceChange = ([drive]: Storage.Device[]) => {
    setIsSelectorOpen(false);
    changeTargetFn(drive);
  };

  return (
    <>
      <MenuButton
        menuProps={{
          "aria-label": sprintf(_("Device %s menu"), modelDevice.name),
          popperProps: { position: "end", maxWidth: "fit-content", minWidth: "fit-content" },
        }}
        customToggle={toggle}
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
      />
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
