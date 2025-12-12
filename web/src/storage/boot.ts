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
import { configModel, partitionableModel } from "~/model/storage";
import type { ConfigModel } from "~/model/storage";

function isUsed(
  config: ConfigModel.Config,
  device: ConfigModel.Drive | ConfigModel.MdRaid,
): boolean {
  return (
    configModel.isTargetDevice(config, device.name) ||
    partitionableModel.usedMountPaths(device).length > 0
  );
}

function removeDevice(
  config: ConfigModel.Config,
  device: ConfigModel.Drive | ConfigModel.MdRaid,
): ConfigModel.Config {
  config.drives = config.drives.filter((d) => d.name !== device.name);
  config.mdRaids = config.mdRaids.filter((d) => d.name !== device.name);
  return config;
}

function setBoot(config: ConfigModel.Config, boot: ConfigModel.Boot) {
  const device = configModel.bootDevice(config);
  if (device && !isUsed(config, device)) removeDevice(config, device);

  config.boot = boot;
  return config;
}

function setBootDevice(config: ConfigModel.Config, deviceName: string): ConfigModel.Config {
  config = copyApiModel(config);

  const boot = {
    configure: true,
    device: {
      default: false,
      name: deviceName,
    },
  };

  setBoot(config, boot);
  return config;
}

function setDefaultBootDevice(config: ConfigModel.Config): ConfigModel.Config {
  config = copyApiModel(config);

  const boot = {
    configure: true,
    device: {
      default: true,
    },
  };

  setBoot(config, boot);
  return config;
}

function disableBootConfig(config: ConfigModel.Config): ConfigModel.Config {
  config = copyApiModel(config);
  const boot = { configure: false };
  setBoot(config, boot);
  return config;
}

export { setBootDevice, setDefaultBootDevice, disableBootConfig };
