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

import { baseName } from "~/components/storage/utils";
import type { ConfigModel } from "~/model/storage/config-model";
import type { SheetEntry } from "~/components/storage/shared/use-sheet";
import type { Storage } from "~/model/system";

/** Another entry of the plan, named and reachable. */
export type Related = { name: string; subject: SheetEntry };

/**
 * The entries built on this device, which is what the device is for.
 *
 * A disk given to a volume group holds nothing of its own, and what it does
 * hold is decided in the panel of whatever it is a member of. Saying which,
 * and offering the way there, is what stops a reader hunting through the list
 * for the other end of a relationship they have just been told about.
 */
function usersOf(
  config: ConfigModel.Config | null,
  systemDevices: Storage.Device[],
  deviceName: string,
): Related[] {
  if (!config) return [];

  const sid = systemDevices.find((device) => device.name === deviceName)?.sid;

  const groups = (config.volumeGroups || [])
    .map((group, index) => ({
      name: group.vgName,
      subject: { collection: "volumeGroups" as const, index },
      targets: group.targetDevices || [],
    }))
    .filter((group) => group.targets.includes(deviceName))
    .map(({ name, subject }) => ({ name, subject }));

  const raids = (config.mdRaids || [])
    .map((raid, index) => ({
      name: baseName(raid.name),
      subject: { collection: "mdRaids" as const, index },
      members: systemDevices.find((device) => device.name === raid.name)?.md?.devices || [],
    }))
    .filter((raid) => sid !== undefined && raid.members.includes(sid))
    .map(({ name, subject }) => ({ name, subject }));

  return [...groups, ...raids];
}

export { usersOf };
