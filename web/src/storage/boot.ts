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

import { copyApiModel } from "~/storage/api-model";
import { configModelMethods, partitionableModelMethods } from "~/model/storage";
import type { ConfigModel } from "~/model/storage";

function isUsed(
  configModel: ConfigModel.Config,
  device: ConfigModel.Drive | ConfigModel.MdRaid,
): boolean {
  return (
    configModelMethods.isTargetDevice(configModel, device.name) ||
    partitionableModelMethods.usedMountPaths(device).length > 0
  );
}

function removeDevice(
  configModel: ConfigModel.Config,
  device: ConfigModel.Drive | ConfigModel.MdRaid,
): ConfigModel.Config {
  configModel.drives = configModel.drives.filter((d) => d.name !== device.name);
  configModel.mdRaids = configModel.mdRaids.filter((d) => d.name !== device.name);
  return configModel;
}

function setBoot(configModel: ConfigModel.Config, boot: ConfigModel.Boot) {
  const device = configModelMethods.bootDevice(configModel);
  if (device && !isUsed(configModel, device)) removeDevice(configModel, device);

  configModel.boot = boot;
  return configModel;
}

function setBootDevice(configModel: ConfigModel.Config, deviceName: string): ConfigModel.Config {
  configModel = copyApiModel(configModel);

  const boot = {
    configure: true,
    device: {
      default: false,
      name: deviceName,
    },
  };

  setBoot(configModel, boot);
  return configModel;
}

function setDefaultBootDevice(configModel: ConfigModel.Config): ConfigModel.Config {
  configModel = copyApiModel(configModel);

  const boot = {
    configure: true,
    device: {
      default: true,
    },
  };

  setBoot(configModel, boot);
  return configModel;
}

function disableBootConfig(configModel: ConfigModel.Config): ConfigModel.Config {
  configModel = copyApiModel(configModel);
  const boot = { configure: false };
  setBoot(configModel, boot);
  return configModel;
}

export { setBootDevice, setDefaultBootDevice, disableBootConfig };
