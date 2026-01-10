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
import type { ConfigModel, Data } from "~/model/storage/config-model";

function find(config: ConfigModel.Config, index: number): ConfigModel.Drive | null {
  return config.drives?.[index] ?? null;
}

function add(config: ConfigModel.Config, data: Data.Drive): ConfigModel.Config {
  config = configModel.clone(config);
  config.drives ||= [];
  config.drives.push(data);

  return config;
}

function addFromMdRaid(
  config: ConfigModel.Config,
  oldName: string,
  drive: Data.Drive,
): ConfigModel.Config {
  return configModel.partitionable.convert(config, oldName, drive.name, "drives");
}

function remove(config: ConfigModel.Config, index: number): ConfigModel.Config {
  return configModel.partitionable.remove(config, "drives", index);
}

export default { find, add, remove, addFromMdRaid };
