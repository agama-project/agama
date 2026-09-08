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

import { useConfigModel } from "~/hooks/model/storage/config-model";
import configModel from "~/model/storage/config-model";
import type { Partitionable } from "~/model/storage/config-model";

/**
 * The device the whole configuration is about, where a single one speaks for it.
 *
 * The page reports one thing either way, and this is what decides how much of
 * that report can be about a device rather than about a plan: a decision the
 * page offers on one disk has no subject at all on three.
 *
 * A lone volume group does not count, although it is a single entry. It is
 * defined rather than found, and a summary of it is a plan about disks it does
 * not name.
 */
function useSingleDevice(): Partitionable.Device | null {
  const config = useConfigModel();
  if (!config) return null;
  if ((config.volumeGroups || []).length > 0) return null;

  const devices = configModel.partitionable.all(config);
  return devices.length === 1 ? devices[0] : null;
}

export { useSingleDevice };
