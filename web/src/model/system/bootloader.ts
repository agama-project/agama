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

import type { System, BootloaderType } from "~/openapi/system/bootloader";

function isTpmAvailable(system: System, type: BootloaderType): boolean {
  const bootloader = system.availableBootloaders.find((b) => b.type === type);
  const encryptionAuth = bootloader?.encryptionAuth || [];
  return encryptionAuth.includes("tpm");
}

function isBls(type: BootloaderType): boolean {
  return ["grub2-bls", "systemd-boot"].includes(type);
}

export default { isTpmAvailable, isBls };
export type * from "~/openapi/system/bootloader";
