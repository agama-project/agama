/*
 * Copyright (c) [2026] SUSE LLC
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
import { sprintf } from "sprintf-js";
import { MenuButtonItem } from "~/components/core/MenuButton";
import configModel from "~/model/storage/config-model";
import { useConfigModel } from "~/hooks/model/storage/config-model";
import { _ } from "~/i18n";
import Icon from "~/components/layout/Icon";
import type { ConfigModel } from "~/model/storage/config-model";
import type { Storage } from "~/model/system";
import type { MenuItemProps } from "@patternfly/react-core";

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

type DescriptionProps = {
  modelDevice: ConfigModel.Drive | ConfigModel.MdRaid;
  actionDescription: React.ReactNode;
};

const Description = ({ modelDevice, actionDescription }: DescriptionProps) => {
  const config = useConfigModel();
  const volumeGroups = configModel.partitionable.filterVolumeGroups(config, modelDevice);
  const isExplicitBoot = configModel.boot.hasExplicitDevice(config, modelDevice.name);
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

  return actionDescription;
};

export type ChangeDeviceMenuItemProps = {
  modelDevice: ConfigModel.Drive | ConfigModel.MdRaid;
  device: Storage.Device;
  actionTitle?: React.ReactNode;
  actionDescription?: React.ReactNode;
  openFn: () => void;
} & MenuItemProps;

/**
 * Internal component holding the presentation of the option to change the device
 */
export default function ChangeDeviceMenuItem({
  modelDevice,
  device,
  actionTitle,
  openFn,
  ...props
}: ChangeDeviceMenuItemProps): React.ReactNode {
  const config = useConfigModel();
  const isDisabled = useOnlyOneOption(config, modelDevice);

  return (
    <MenuButtonItem
      aria-label={_("Change device menu")}
      icon={<Icon size="md" name="move_down" />}
      description={<Description modelDevice={modelDevice} actionDescription={actionTitle} />}
      isDisabled={isDisabled}
      key="retarget"
      {...props}
      onClick={isDisabled ? undefined : openFn}
    >
      {isDisabled ? _("Selected disk cannot be changed") : _("Change target disk")}
    </MenuButtonItem>
  );
}
