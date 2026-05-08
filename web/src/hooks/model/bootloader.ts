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

import bootloaderSystem from "~/model/system/bootloader";
import configModel from "~/model/storage/config-model";
import { useSystem } from "~/hooks/model/system/bootloader";
import { useConfigModel } from "~/hooks/model/storage/config-model";
import { isNullish } from "radashi";

function useIsTpmAvailable(): boolean {
  const system = useSystem();
  const config = useConfigModel();
  const bootloaderType = config ? configModel.getBootloader(config) : null;

  if (isNullish(system) || isNullish(bootloaderType)) return false;

  return bootloaderSystem.isTpmAvailable(system, bootloaderType);
}

export { useIsTpmAvailable };
