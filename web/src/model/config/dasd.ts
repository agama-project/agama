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

import { Config, Device } from "~/openapi/config/dasd";

function findDeviceIndex(config: Config, channel: string): number | undefined {
  return config.devices?.findIndex((d) => d.channel === channel);
}

function findDevice(config: Config, channel: string): Device | undefined {
  return config.devices?.find((d) => d.channel === channel);
}

function addDevice(config: Config, device: Device): Config {
  return { devices: [...(config.devices || []), device] };
}

function removeDevice(config: Config, channel: string): Config {
  const devices = config.devices.filter((d) => d.channel !== channel);
  return { ...config, devices };
}

export default { findDeviceIndex, findDevice, addDevice, removeDevice };
export type * from "~/openapi/config/dasd";
