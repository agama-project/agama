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
import type { ConfigModel } from "~/model/storage";

function usedMountPaths(volumeGroup: ConfigModel.VolumeGroup): string[] {
  const mountPaths = (volumeGroup.logicalVolumes || []).map((l) => l.mountPath);
  return sift(mountPaths);
}

function candidateTargetDevices(
  config: ConfigModel.Config,
): (ConfigModel.Drive | ConfigModel.MdRaid)[] {
  const drives = config.drives || [];
  const mdRaids = config.mdRaids || [];
  return [...drives, ...mdRaids];
}

function filterTargetDevices(
  volumeGroup: ConfigModel.VolumeGroup,
  config: ConfigModel.Config,
): (ConfigModel.Drive | ConfigModel.MdRaid)[] {
  return candidateTargetDevices(config).filter((d) => volumeGroup.targetDevices.includes(d.name));
}

export { usedMountPaths, filterTargetDevices };
