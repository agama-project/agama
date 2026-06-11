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

import type { Storage as System } from "~/model/system";
import type { Storage as Proposal } from "~/model/proposal";
import { flat, isEmpty, sift } from "radashi";

type Device = System.Device | Proposal.Device;

function isDrive(device: Device): boolean {
  return device.class === "drive";
}

function isVolumeGroup(device: Device): boolean {
  return device.class === "volumeGroup";
}

function isMd(device: Device): boolean {
  return device.class === "mdRaid";
}

function isPartition(device: Device): boolean {
  return device.class === "partition";
}

function isLogicalVolume(device: Device): boolean {
  return device.class === "logicalVolume";
}

function deviceSystems(device: Device): string[] {
  if (device.class === "volumeGroup")
    return sift(flat(device.logicalVolumes.map((l) => l.block.systems)));

  return device.block?.systems || [];
}

function supportShrink(device: Device): boolean {
  return device.block?.shrinking?.supported || false;
}

/**
 * Whether the device currently holds data that formatting it would destroy.
 *
 * Relies on structural signals only: a filesystem of its own, logical volumes
 * (when it is a volume group), a partition table with partitions, or detected
 * installed systems. A device that holds content but reports none of these is
 * treated as empty on purpose; that gap belongs to the backend, not here.
 */
function hasContent(device: Device): boolean {
  if (device.filesystem) return true;
  if (isVolumeGroup(device)) return !isEmpty(device.logicalVolumes);
  if (device.partitionTable) return !isEmpty(device.partitions);

  return deviceSystems(device).length > 0;
}

export {
  isDrive,
  isVolumeGroup,
  isMd,
  isPartition,
  isLogicalVolume,
  deviceSystems,
  supportShrink,
  hasContent,
};
