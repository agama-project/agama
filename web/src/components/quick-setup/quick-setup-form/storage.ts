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

/**
 * What Quick setup reads from the disks and the storage model.
 */

import { isEmpty, unique } from "radashi";
import { EXISTING_CONTENT } from "./fields";

import type { ConfigModel } from "~/model/storage/config-model";
import type { Storage } from "~/model/system";
import type { ExistingContent } from "./fields";

/** The systems found on a disk, such as "Windows 11", from all its partitions. */
export function diskSystems(disk: Storage.Device): string[] {
  return unique([
    ...(disk.block?.systems ?? []),
    ...(disk.partitions ?? []).flatMap((p) => p.block?.systems ?? []),
  ]);
}

/** Whether a disk holds nothing: no partitions, no file system, no system. */
export function isEmptyDisk(disk: Storage.Device): boolean {
  return isEmpty(disk.partitions) && !disk.filesystem && isEmpty(diskSystems(disk));
}

/**
 * The disk and existing content choice a storage model stands for, if it is
 * one Quick setup could have made: a single disk, deleting or shrinking.
 * Anything else is a setup made on the storage page.
 */
export function quickSetupStorage(
  model: ConfigModel.Config | null,
): { disk: string; existingContent: ExistingContent } | undefined {
  const drives = model?.drives ?? [];
  if (drives.length !== 1 || !isEmpty(model?.mdRaids)) return undefined;

  const [drive] = drives;
  const policies: string[] = Object.values(EXISTING_CONTENT);
  if (!policies.includes(drive.spacePolicy)) return undefined;

  return { disk: drive.name, existingContent: drive.spacePolicy as ExistingContent };
}

/** Names of the disks a storage model uses, for telling about it. */
export function modelDisks(model: ConfigModel.Config | null): string[] {
  return [...(model?.drives ?? []), ...(model?.mdRaids ?? [])].map((d) => d.name);
}
