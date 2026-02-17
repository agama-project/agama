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

import { Config, Target } from "~/openapi/config/iscsi";
import { remove } from "radashi";

function setInitiator(config: Config, name: string): Config {
  return { ...config, initiator: name };
}

function addTarget(config: Config, target: Target): Config {
  return { ...config, targets: [...config.targets, target] };
}

function removeTarget(config: Config, name: string, addr: string, port: number): Config {
  return {
    ...config,
    targets: remove(
      config.targets,
      (t) => t.name === name && t.address === addr && t.port === port,
    ),
  };
}

export default { setInitiator, addTarget, removeTarget };
export type * from "~/openapi/config/iscsi";
