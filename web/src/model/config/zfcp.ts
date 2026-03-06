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
import { unique } from "radashi";

function defaultConfig(): Config {
  return {};
}

function findDeviceIndex(devices: Device[], device: Device): number {
  return devices.findIndex(
    (d) => d.channel === device.channel && d.wwpn === device.wwpn && d.lun === device.lun,
  );
}

function addDevice(config: Config, device: Device): Config {
  const devices = [...(config.devices || [])];
  const index = findDeviceIndex(devices, device);

  if (index === -1) {
    return { ...config, devices: [...devices, device] };
  } else {
    return { ...config, devices: devices.with(index, device) };
  }
}

/** Returns a new config adding the given controllers. */
function addControllers(config: Config | null, controllers: string[]): Config {
  const currentConfig = config || defaultConfig();

  return {
    ...currentConfig,
    controllers: unique([...(currentConfig.controllers || []), ...controllers]),
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
  const currentConfig = config || defaultConfig();

  if (devices.length === 0) return { ...currentConfig };

  const [device, ...rest] = devices;

  return addDevices(addDevice(currentConfig, device), rest);
}

export type * from "~/openapi/config/zfcp";
export default { addControllers, addDevice, addDevices };
