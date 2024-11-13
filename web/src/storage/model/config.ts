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

import { config } from "~/api/storage/types";
import { Drive, generate as generateDrive } from "~/storage/model/config/drive";

export type Device = Drive;

class ConfigDevicesGenerator {
  private config: config.Config;
  private solvedConfig: config.Config;

  constructor(config: config.Config, solvedConfig: config.Config) {
    this.config = config;
    this.solvedConfig = solvedConfig;
  }

  generate(): Device[] {
    return this.generateDrives();
  }

  private generateDrives(): Drive[] {
    const solvedDriveConfigs = this.solvedConfig.drives || [];
    return solvedDriveConfigs.map((c) => this.generateDrive(c));
  }

  private generateDrive(solvedDriveConfig: config.DriveElement): Drive {
    const driveConfig = (this.config.drives || [])[solvedDriveConfig.index];
    return generateDrive(driveConfig, solvedDriveConfig);
  }
}

export function generate(config: config.Config, solvedConfig: config.Config): Device[] {
  const generator = new ConfigDevicesGenerator(config, solvedConfig);
  return generator.generate();
}
