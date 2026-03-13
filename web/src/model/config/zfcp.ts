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

import { Config, Device } from "~/openapi/config/zfcp";
import { replaceOrAppend, remove, isEmpty } from "radashi";

const DEFAULT_CONFIG: Config = {};

/** Generates a copy of the given config or a default config. */
function ensureConfig(config: Config | null): Config {
  return config ? { ...config } : { ...DEFAULT_CONFIG };
}

/** Returns a new config setting the given controllers. */
function setControllers(config: Config | null, controllers: string[]): Config {
  const baseConfig = ensureConfig(config);
  return { ...baseConfig, controllers };
}

function addDevice(config: Config | null, device: Device): Config {
  const baseConfig = ensureConfig(config);

  return {
    ...baseConfig,
    devices: replaceOrAppend(
      baseConfig.devices,
      device,
      (d) => d.channel === device.channel && d.wwpn === device.wwpn && d.lun === device.lun,
    ),
  };
}

/**
 * Returns a new config adding the given devices.
 *
 * The returned config contains all the devices from the given config plus the given list of
 * devices. If a device of the list already exists in the given config, then the device from the
 * list replaces the device from the config.
 */
function addDevices(config: Config | null, devices: Device[]): Config {
  const baseConfig = ensureConfig(config);

  if (isEmpty(devices)) return baseConfig;

  return devices.reduce(
    (newConfig: Config, device: Device): Config => addDevice(newConfig, device),
    baseConfig,
  );
}

function removeDevice(config: Config | null, device: Device): Config {
  const baseConfig = ensureConfig(config);

  return {
    ...baseConfig,
    devices: remove(
      baseConfig.devices || [],
      (d) => d.channel === device.channel && d.wwpn === device.wwpn && d.lun === device.lun,
    ),
  };
}

/**
 * Returns a new config removing the given devices.
 */
function removeDevices(config: Config | null, devices: Device[]): Config {
  const baseConfig = ensureConfig(config);

  if (isEmpty(devices) || isEmpty(baseConfig.devices)) return baseConfig;

  return devices.reduce(
    (newConfig: Config, device: Device): Config => removeDevice(newConfig, device),
    baseConfig,
  );
}

export type * from "~/openapi/config/zfcp";
export default { setControllers, addDevice, addDevices, removeDevices };
