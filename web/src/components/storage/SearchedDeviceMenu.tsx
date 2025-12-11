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
import { useConfigModel } from "~/hooks/model/storage";
import { useSwitchToDrive } from "~/hooks/storage/drive";
import { useSwitchToMdRaid } from "~/hooks/storage/md-raid";
import { deviceBaseName, formattedPath } from "~/components/storage/utils";
import { configModelMethods, partitionableModelMethods } from "~/model/storage";
import { sprintf } from "sprintf-js";
import { _, formatList } from "~/i18n";
import DeviceSelectorModal from "./DeviceSelectorModal";
import { MenuItemProps } from "@patternfly/react-core";
import { isDrive } from "~/storage/device";
import type { storage } from "~/model/system";
import type { configModel } from "~/model/storage";

const baseName = (device: storage.Device): string => deviceBaseName(device, true);

const useOnlyOneOption = (
  configModel: configModel.Config,
  device: configModel.Drive | configModel.MdRaid,
): boolean => {
  if (device.filesystem && device.filesystem.reuse) return true;

  const isTargetDevice = configModelMethods.isTargetDevice(configModel, device.name);

  if (
    !partitionableModelMethods.usedMountPaths(device).length &&
    (isTargetDevice || configModelMethods.isExplicitBootDevice(configModel, device.name))
  )
    return true;

  return partitionableModelMethods.isReusingPartitions(device);
};

type ChangeDeviceTitleProps = {
  modelDevice: configModel.Drive | configModel.MdRaid;
};

const ChangeDeviceTitle = ({ modelDevice }: ChangeDeviceTitleProps) => {
  const configModel = useConfigModel();
  const onlyOneOption = useOnlyOneOption(configModel, modelDevice);
  if (onlyOneOption) {
    return _("Selected disk cannot be changed");
  }

  if (modelDevice.filesystem) {
    // TRANSLATORS: %s is a formatted mount point like '"/home"'
    return sprintf(_("Change the disk to format as %s"), formattedPath(modelDevice.mountPath));
  }

  const mountPaths = partitionableModelMethods.usedMountPaths(modelDevice);
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
  modelDevice: configModel.Drive | configModel.MdRaid;
  device: storage.Device;
};

const ChangeDeviceDescription = ({ modelDevice, device }: ChangeDeviceDescriptionProps) => {
  const configModel = useConfigModel();
  const name = baseName(device);
  const volumeGroups = partitionableModelMethods.selectVolumeGroups(modelDevice, configModel);
  const isExplicitBoot = configModelMethods.isExplicitBootDevice(configModel, modelDevice.name);
  const isBoot = configModelMethods.isBootDevice(configModel, modelDevice.name);
  const mountPaths = partitionableModelMethods.usedMountPaths(modelDevice);
  const isReusingPartitions = partitionableModelMethods.isReusingPartitions(modelDevice);
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
  modelDevice: configModel.Drive | configModel.MdRaid;
  device: storage.Device;
} & MenuItemProps;

/**
 * Internal component holding the presentation of the option to change the device
 */
const ChangeDeviceMenuItem = ({
  modelDevice,
  device,
  ...props
}: ChangeDeviceMenuItemProps): React.ReactNode => {
  const configModel = useConfigModel();
  const onlyOneOption = useOnlyOneOption(configModel, modelDevice);

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
  device: configModel.Drive | configModel.MdRaid;
  onClick: (device: configModel.Drive | configModel.MdRaid) => void;
};

const RemoveEntryOption = ({ device, onClick }: RemoveEntryOptionProps): React.ReactNode => {
  const configModel = useConfigModel();

  /*
   * Pretty artificial logic used to decide whether the UI should display buttons to remove
   * some drives.
   */
  const hasAdditionalDrives = (configModel: configModel.Config): boolean => {
    const entries = configModel.drives.concat(configModel.mdRaids);

    if (entries.length <= 1) return false;
    if (entries.length > 2) return true;

    // If there are only two drives, the following logic avoids the corner case in which first
    // deleting one of them and then changing the boot settings can lead to zero disks. But it is far
    // from being fully reasonable or understandable for the user.
    const onlyToBoot = entries.find(
      (e) =>
        configModelMethods.isExplicitBootDevice(configModel, e.name) &&
        !configModelMethods.isUsedDevice(configModel, e.name),
    );
    return !onlyToBoot;
  };

  // When no additional drives has been added, the "Do not use" button can be confusing so it is
  // omitted for all drives.
  if (!hasAdditionalDrives(configModel)) return;

  let description;
  const isExplicitBoot = configModelMethods.isExplicitBootDevice(configModel, device.name);
  const hasPv = configModelMethods.isTargetDevice(configModel, device.name);
  const isDisabled = isExplicitBoot || hasPv;

  // If these cases, the target device cannot be changed and this disabled button would only provide
  // information that is redundant to the one already displayed at the disabled "change device" one.
  if (!partitionableModelMethods.usedMountPaths(device).length && (hasPv || isExplicitBoot)) return;

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
  modelDevice: configModel.Drive | configModel.MdRaid,
  configModel: configModel.Config,
  availableDevices: storage.Device[],
): storage.Device[] => {
  return availableDevices.filter((availableDev) => {
    if (modelDevice.name === availableDev.name) return true;

    const collection = isDrive(availableDev) ? configModel.drives : configModel.mdRaids;
    const device = collection.find((d) => d.name === availableDev.name);
    if (!device) return true;

    return modelDevice.filesystem
      ? !configModelMethods.isUsedDevice(configModel, device.name)
      : !device.filesystem;
  });
};

export type SearchedDeviceMenuProps = {
  selected: storage.Device;
  modelDevice: configModel.Drive | configModel.MdRaid;
  toggle?: React.ReactElement<CustomToggleProps>;
  deleteFn: (device: configModel.Drive | configModel.MdRaid) => void;
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
  const switchToDrive = useSwitchToDrive();
  const switchToMdRaid = useSwitchToMdRaid();
  const changeTargetFn = (device: storage.Device) => {
    const hook = isDrive(device) ? switchToDrive : switchToMdRaid;
    hook(modelDevice.name, { name: device.name });
  };
  const devices = targetDevices(modelDevice, useConfigModel(), useAvailableDevices());

  const onDeviceChange = ([drive]: storage.Device[]) => {
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
