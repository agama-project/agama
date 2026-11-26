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

import configModel from "~/model/storage/config-model";
import type { IconProps } from "~/components/layout/Icon";
import type { ConfigModel } from "~/model/storage/config-model";

/**
 * The icon for how the machine is set to boot, so every place that shows the
 * boot setting marks it the same way.
 *
 * - Not configured: a blocked sign.
 * - Chosen by the installer: a turning arrow with an A.
 * - Chosen by hand: the same arrow without the A.
 */
function bootIcon(config: ConfigModel.Config): IconProps["name"] {
  if (!config.boot?.configure) return "block";
  if (configModel.boot.isDefault(config)) return "rotate_auto";
  return "settings_backup_restore";
}

export { bootIcon };
