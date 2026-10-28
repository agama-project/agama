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
 * Hostname proposal from the backend.
 *
 * **Important**: The backend returns different JSON shapes based on hostname
 * configuration:
 *
 *   - Transient mode: `{ "hostname": "dhcp-provided-name" }`
 *   - Static mode: `{ "hostname": "dhcp-provided-name", "static": "configured-name" }`
 *
 * This inconsistency exists because the backend uses `Option<String>` with
 * `skip_serializing_if` for the static field, and converts empty static
 * hostname to None. This design mirrors systemd's hostnamectl behavior where
 * transient and static hostnames are separate concepts.
 *
 * @property hostname - The current transient hostname (provided by
 *                      network/DHCP). Always present.
 * @property static - The configured static hostname that persists across
 *                    reboots. Undefined when not set (transient mode).
 */
type Proposal = {
  hostname: string;
  static?: string;
};

export type { Proposal };
