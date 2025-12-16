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

import configModel from "~/model/storage/config-model";
import type { ConfigModel } from "~/model/storage/config-model";

function deleteIfUnused(config: ConfigModel.Config, name: string): ConfigModel.Config {
  config = configModel.clone(config);

  const location = configModel.partitionable.findLocation(config, name);
  if (!location) return config;

  const { collection, index } = location;
  const device = configModel.partitionable.find(config, collection, index);
  if (!device) return config;
  if (configModel.partitionable.isUsed(config, device.name)) return config;

  config[collection].splice(index, 1);
  return config;
}

export { deleteIfUnused };
