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

import React, { useState } from "react";
import { sprintf } from "sprintf-js";
import DeviceSelectorModal from "~/components/storage/DeviceSelectorModal";
import { deviceBaseName, formattedPath } from "~/components/storage/utils";
import { isDrive, isMd, isVolumeGroup } from "~/model/storage/device";
import configModel from "~/model/storage/config-model";
import { useConfigModel, useConvertDevice } from "~/hooks/model/storage/config-model";
import { useAvailableDevices } from "~/hooks/model/system/storage";
import { _, n_, formatList, TranslatedString } from "~/i18n";
import type { ConfigModel } from "~/model/storage/config-model";
import type { Partitionable } from "~/model/storage/config-model";
import type { Storage } from "~/model/system";

type Retarget = {
  /** The title that describes what is going to happen. */
  title: React.ReactNode;
  /** Further details about the consequences. */
  description: React.ReactNode;
  /** Opens the device selector. */
  open: () => void;
  /** The device selector, for the caller to render. */
  selector: React.ReactNode;
};

/**
 * What will be created as logical volumes when reusing a volume group, or
 * undefined when nothing is. A string rather than a component, so callers can
 * tell whether there is anything to render.
 */
const reuseVgSideEffect = (
  deviceConfig: ConfigModel.Drive | ConfigModel.MdRaid,
): string | undefined => {
  const paths = (deviceConfig.partitions || [])
    .filter((p) => !p.name)
    .map((p) => formattedPath(p.mountPath));

  if (paths.length) {
    return sprintf(
      n_(
        // TRANSLATORS: %s is a list of formatted mount points like '"/", "/var" and "swap"' (or a
        // single mount point in the singular case).
        "%s will be created as a logical volume",
        "%s will be created as logical volumes",
        paths.length,
      ),
      formatList(paths),
    );
  }
};

type DescriptionProps = {
  modelDevice: ConfigModel.Drive | ConfigModel.MdRaid;
  device: Storage.Device;
};

const Description = ({ modelDevice, device }: DescriptionProps) => {
  const config = useConfigModel();
  const volumeGroups = configModel.partitionable.filterVolumeGroups(config, modelDevice);
  const isExplicitBoot = configModel.boot.hasExplicitDevice(config, modelDevice.name);
  const isBoot = configModel.boot.hasDevice(config, modelDevice.name);
  const hasPv = volumeGroups.length > 0;
  const vgName = volumeGroups[0]?.vgName;
  const devName = deviceBaseName(device, { truncate: true });

  if (hasPv) {
    if (volumeGroups.length > 1) {
      if (isExplicitBoot) {
        return sprintf(
          // TRANSLATORS: %s is the name of the disk, such as "sda"
          _("%s will still contain the configured LVM groups and any partition needed to boot"),
          devName,
        );
      }

      // TRANSLATORS: %s is the name of the disk, such as "sda"
      return sprintf(_("The configured LVM groups will remain at %s"), devName);
    }

    if (isExplicitBoot) {
      return sprintf(
        // TRANSLATORS: %1$s is the name of the disk, such as "sda" and %2$s the name of the volume
        // group
        _("%1$s will still contain the LVM group '%2$s' and any partition needed to boot"),
        devName,
        vgName,
      );
    }

    return sprintf(
      // TRANSLATORS: %1$s is the name of the volume group and %2$s the name of the disk such as
      // "sda"
      _("The LVM group '%1$s' will remain at %2$s"),
      vgName,
      devName,
    );
  }

  if (isExplicitBoot) {
    // TRANSLATORS: %s is the name of the disk, such as "sda"
    return sprintf(_("Partitions needed for booting will remain at %s"), devName);
  }

  if (isBoot) {
    return _("Partitions needed for booting will also be adapted");
  }
};

type TitleProps = {
  modelDevice: ConfigModel.Drive | ConfigModel.MdRaid;
};

const Title = ({ modelDevice }: TitleProps) => {
  if (modelDevice.filesystem) {
    return sprintf(
      // TRANSLATORS: %s is a formatted mount point like '"/home"'
      _("Choose a different device to format as %s"),
      formattedPath(modelDevice.mountPath),
    );
  }

  const newMountPaths = modelDevice.partitions.filter((p) => !p.name).map((p) => p.mountPath);
  const hasMountPaths = newMountPaths.length > 0;

  if (!hasMountPaths) {
    return _("Choose a different device to configure");
  }

  if (newMountPaths.includes("/")) {
    return _("Choose a different device to install the system");
  }

  return sprintf(
    // TRANSLATORS: %s is a list of formatted mount points like '"/", "/var" and "swap"'
    _("Choose a different device to create %s"),
    formatList(newMountPaths.map((p) => formattedPath(p))),
  );
};

const targetDevices = (
  deviceConfig: ConfigModel.Drive | ConfigModel.MdRaid,
  config: ConfigModel.Config,
  availableDevices: Storage.Device[],
): Storage.Device[] => {
  return availableDevices.filter((availableDevice) => {
    if (deviceConfig.name === availableDevice.name) return true;

    const availableDeviceConfig = configModel.findDeviceByName(config, availableDevice.name);

    if (deviceConfig.filesystem) {
      if (isVolumeGroup(availableDevice)) return false;
      if (!availableDeviceConfig) return true;
      return !configModel.partitionable.isUsed(config, availableDeviceConfig.name);
    } else {
      if (!availableDeviceConfig) return true;
      if ("filesystem" in availableDeviceConfig) return !availableDeviceConfig.filesystem;
      return true;
    }
  });
};

/**
 * Moves everything planned for one device to another one. Every place offering
 * it uses this hook, so they cannot disagree on which devices are available.
 * The caller renders the control and the selector.
 *
 * @example
 * const { open, selector } = useRetarget(entry, device);
 *
 * <Button onClick={open}>{_("Use another device")}</Button>
 * {selector}
 */
function useRetarget(entry: Partitionable.Device, device: Storage.Device): Retarget {
  const config = useConfigModel();
  const convertDevice = useConvertDevice();
  const vgSelectionSideEffect = reuseVgSideEffect(entry);
  const targets = targetDevices(entry, config, useAvailableDevices());
  const [isOpen, setIsOpen] = useState(false);

  const vgEmptyStateTitle = (): TranslatedString | undefined => {
    return entry.filesystem ? _("Volume groups cannot be formatted") : undefined;
  };

  return {
    title: <Title modelDevice={entry} />,
    description: <Description modelDevice={entry} device={device} />,
    open: () => setIsOpen(true),
    selector: isOpen && (
      <DeviceSelectorModal
        title={<Title modelDevice={entry} />}
        intro={<Description modelDevice={entry} device={device} />}
        selected={device}
        disks={targets.filter(isDrive)}
        mdRaids={targets.filter(isMd)}
        volumeGroups={targets.filter(isVolumeGroup)}
        sideEffects={{ volumeGroups: vgSelectionSideEffect }}
        emptyStateTitles={{ volumeGroups: vgEmptyStateTitle() }}
        onCancel={() => setIsOpen(false)}
        onConfirm={([target]: Storage.Device[]) => {
          setIsOpen(false);
          convertDevice(entry.name, target.name);
        }}
      />
    ),
  };
}

export { useRetarget };
