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
import type { Storage as Proposal } from "~/model/proposal";
import type { Storage as System } from "~/model/system";

/** Where a partition set aside for booting is mounted, where it is mounted at all. */
const BOOT_PATHS = ["/boot", "/boot/efi", "/boot/zipl"];

/**
 * What the backend calls a partition set aside for booting. A partition with no
 * file system describes itself by its partition id in words, "BIOS Boot
 * Partition", "EFI System Partition", and that description is the only place the
 * id reaches the page.
 */
const BOOT_DESCRIPTIONS = /boot|efi|prep|zipl/i;

/** Whether a partition is there to start the machine. */
function isBootPartition(device: Proposal.Device): boolean {
  return (
    device.partition?.efi === true ||
    BOOT_PATHS.includes(device.filesystem?.mountPath || "") ||
    BOOT_DESCRIPTIONS.test(device.description || "")
  );
}

/** One partition the machine will start from, and whether it is there yet. */
export type BootPartition = { name: string; size?: number; isNew: boolean };

/**
 * What booting costs a device, read from the plan rather than the configuration.
 *
 * Nothing in the configuration asks for boot partitions: the installer adds
 * them, so they appear in no view of what was asked for, and a device would look
 * as though it hosted the boot loader for free. Comparing the plan against the
 * machine says which are new and which the device already had.
 *
 * A BIOS boot or PReP partition carries no file system and nothing to mount, so
 * nothing about it says "boot" except that the plan adds it and the
 * configuration never asked for it.
 */
function bootPartitionsOf(
  deviceName: string,
  device: System.Device | null,
  staging: Proposal.Device[],
): BootPartition[] {
  const planned = staging.find((candidate) => candidate.name === deviceName);
  const known = new Set((device?.partitions || []).map((partition) => partition.sid));

  return (planned?.partitions || [])
    .filter(
      (partition) =>
        isBootPartition(partition) || (!known.has(partition.sid) && !partition.filesystem),
    )
    .map((partition) => ({
      name: baseName(partition.name),
      size: partition.block?.size,
      isNew: !known.has(partition.sid),
    }));
}

export { bootPartitionsOf };
