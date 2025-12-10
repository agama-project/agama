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

import type * as configModel from "~/openapi/storage/config-model";

function bootDevice(model: configModel.Config): configModel.Drive | configModel.MdRaid | null {
  const targets = [...model.drives, ...model.mdRaids];
  return targets.find((d) => d.name && d.name === model.boot?.device?.name) || null;
}

function isDefaultBoot(model: configModel.Config): boolean {
  return model.boot?.device?.default || false;
}

function isBoot(model: configModel.Config, deviceName: string): boolean {
  return model.boot?.configure && model.boot.device?.name === deviceName;
}

function isExplicitBoot(model: configModel.Config, deviceName: string): boolean {
  return isBoot(model, deviceName) && !isDefaultBoot(model);
}

export { bootDevice, isDefaultBoot, isBoot, isExplicitBoot };
