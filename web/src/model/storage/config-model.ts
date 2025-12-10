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

import * as partitionable from "~/model/storage/config-model/partitionable";
import * as volumeGroup from "~/model/storage/config-model/volume-group";
import type * as configModel from "~/openapi/storage/config-model";

function usedMountPaths(model: configModel.Config): string[] {
  const drives = model.drives || [];
  const mdRaids = model.mdRaids || [];
  const volumeGroups = model.volumeGroups || [];

  return [
    ...drives.flatMap(partitionable.usedMountPaths),
    ...mdRaids.flatMap(partitionable.usedMountPaths),
    ...volumeGroups.flatMap(volumeGroup.usedMountPaths),
  ];
}

function isTargetDevice(model: configModel.Config, deviceName: string): boolean {
  const targetDevices = (model.volumeGroups || []).flatMap((v) => v.targetDevices || []);
  return targetDevices.includes(deviceName);
}

export * as boot from "~/model/storage/config-model/boot";
export * as partition from "~/model/storage/config-model/partition";
export { usedMountPaths, isTargetDevice };
export type { configModel };
