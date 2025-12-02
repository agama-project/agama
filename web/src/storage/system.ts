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

import { sift } from "radashi";
import type { System, Device } from "~/api/system/storage";

function flatDevices(system: System): Device[] {
  const partitions = system.devices?.flatMap((d) => d.partitions);
  const logicalVolumes = system.devices?.flatMap((d) => d.logicalVolumes);
  return sift([system.devices, partitions, logicalVolumes].flat());
}

function findDevice(system: System, sid: number): Device | undefined {
  const device = flatDevices(system).find((d) => d.sid === sid);
  if (device === undefined) console.warn("Device not found:", sid);

  return device;
}

function findDevices(system: System, sids: number[]): Device[] {
  return sids.map((sid) => findDevice(system, sid)).filter((d) => d);
}

function findDeviceByName(system: System, name: string): Device | null {
  return flatDevices(system).find((d) => d.name === name) || null;
}

export { flatDevices, findDevice, findDevices, findDeviceByName };
