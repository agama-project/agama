/*
 * Copyright (c) [2024] SUSE LLC
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

/*
 * Enum that represents the installation phase
 */
enum InstallationPhase {
  Startup = 0,
  Config = 1,
  Install = 2,
  Finish = 3,
}

/*
 * Status of the installer
 */
type InstallerStatus = {
  /** Whether the installer is busy */
  isBusy: boolean;
  /** Installation phase */
  phase: InstallationPhase;
  /** Whether the installation can be performed or not */
  canInstall: boolean;
  /** Whether the installer is running on Iguana */
  useIguana: boolean;
};

export type { InstallerStatus };
export { InstallationPhase };
