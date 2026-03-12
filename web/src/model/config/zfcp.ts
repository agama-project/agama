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

function defaultConfig(): Config {
  return {};
}

/** Returns a new config setting the given controllers. */
function setControllers(config: Config | null, controllers: string[]): Config {
  const currentConfig = config || defaultConfig();
  return { ...currentConfig, controllers };
}

function addDevice(config: Config | null, device: Device): Config {
  const currentConfig = config || defaultConfig();

  return {
    ...currentConfig,
    devices: replaceOrAppend(
      currentConfig.devices,
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
  const currentConfig = config || defaultConfig();

  if (isEmpty(devices)) return { ...currentConfig };

  const [device, ...rest] = devices;

  return addDevices(addDevice(currentConfig, device), rest);
}

function removeDevice(config: Config | null, device: Device): Config {
  const currentConfig = config || defaultConfig();

  return {
    ...currentConfig,
    devices: remove(
      currentConfig.devices || [],
      (d) => d.channel === device.channel && d.wwpn === device.wwpn && d.lun === device.lun,
    ),
  };
}

/**
 * Returns a new config removing the given devices.
 */
function removeDevices(config: Config | null, devices: Device[]): Config {
  const currentConfig = config || defaultConfig();

  if (isEmpty(devices) || isEmpty(currentConfig.devices)) return { ...currentConfig };

  const [device, ...rest] = devices;

  return removeDevices(removeDevice(currentConfig, device), rest);
}

export type * from "~/openapi/config/zfcp";
export default { setControllers, addDevice, addDevices, removeDevices };
