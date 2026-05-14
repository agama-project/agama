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

/**
 * Hostname configuration for PATCH requests.
 *
 * Used to update hostname settings via `patchConfig({ hostname: {...} })`.
 *
 * To set a static hostname:
 * ```typescript
 * patchConfig({ hostname: { static: "my-server" } })
 * ```
 *
 * To clear static hostname (switch to transient mode):
 * ```typescript
 * patchConfig({ hostname: { static: "" } })
 * ```
 *
 * @property static - The static hostname value. Set to empty string to clear
 *                    and use transient mode.
 * @property hostname - The transient hostname. Typically not set via config, as
 *                      it's provided by the network.
 */
type Config = {
  static?: string;
  hostname?: string;
};

export type { Config };
