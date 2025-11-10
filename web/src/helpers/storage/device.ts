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

// FIXME: the backend should provide the type.

import { system, proposal } from "~/api/storage";

type Device = system.Device | proposal.Device;

function isDrive(device: Device): boolean {
  return device.drive !== undefined;
}

function isVolumeGroup(device: Device): boolean {
  return device.volumeGroup !== undefined;
}

function isMd(device: Device): boolean {
  return device.md !== undefined;
}

function isMultipath(device: Device): boolean {
  return device.multipath !== undefined;
}

function isPartition(device: Device): boolean {
  return device.partition !== undefined;
}

function isLogicalVolume(device: Device): boolean {
  return !(
    isDrive(device) ||
    isVolumeGroup(device) ||
    isMd(device) ||
    isMultipath(device) ||
    isPartition(device)
  );
}

enum DeviceType {
  Drive,
  VolumeGroup,
  Md,
  Multipath,
  Partition,
  LogicalVolume,
}

function deviceType(device: Device): DeviceType | undefined {
  if (isDrive(device)) return DeviceType.Drive;
  if (isVolumeGroup(device)) return DeviceType.VolumeGroup;
  if (isMd(device)) return DeviceType.Md;
  if (isMultipath(device)) return DeviceType.Multipath;
  if (isPartition(device)) return DeviceType.Partition;
  if (isLogicalVolume(device)) return DeviceType.LogicalVolume;

  return undefined;
}

function deviceSystems(device: Device): string[] {
  return device?.block?.systems || [];
}

export {
  DeviceType,
  isDrive,
  isVolumeGroup,
  isMd,
  isMultipath,
  isPartition,
  isLogicalVolume,
  deviceType,
  deviceSystems,
};
