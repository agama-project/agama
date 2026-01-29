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

import configModel from "~/model/storage/config-model";
import type { ConfigModel, Partitionable } from "~/model/storage/config-model";

function findDevice(config: ConfigModel.Config): Partitionable.Device | null {
  return (
    configModel.partitionable
      .all(config)
      .find((d) => d.name && d.name === config.boot?.device?.name) || null
  );
}

function isDefault(config: ConfigModel.Config): boolean {
  return config.boot?.device?.default || false;
}

function hasDevice(config: ConfigModel.Config, deviceName: string): boolean {
  return config.boot?.configure && config.boot.device?.name === deviceName;
}

function hasExplicitDevice(config: ConfigModel.Config, deviceName: string): boolean {
  return hasDevice(config, deviceName) && !isDefault(config);
}

function setBoot(config: ConfigModel.Config, boot: ConfigModel.Boot): ConfigModel.Config {
  config = configModel.clone(config);
  const device = findDevice(config);
  config.boot = null;

  if (device && !configModel.partitionable.isUsed(config, device.name)) {
    const location = configModel.partitionable.findLocation(config, device.name);
    if (location)
      config = configModel.partitionable.remove(config, location.collection, location.index);
  }

  config.boot = boot;
  return config;
}

function setDevice(config: ConfigModel.Config, deviceName: string): ConfigModel.Config {
  const boot = {
    configure: true,
    device: {
      default: false,
      name: deviceName,
    },
  };

  return setBoot(config, boot);
}

function setDefault(config: ConfigModel.Config): ConfigModel.Config {
  const boot = {
    configure: true,
    device: {
      default: true,
    },
  };

  return setBoot(config, boot);
}

function disable(config: ConfigModel.Config): ConfigModel.Config {
  return setBoot(config, { configure: false });
}

export default {
  findDevice,
  isDefault,
  hasDevice,
  hasExplicitDevice,
  setDevice,
  setDefault,
  disable,
};
