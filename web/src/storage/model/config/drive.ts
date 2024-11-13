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
import * as checks from "~/api/storage/types/checks";
import {
  Partition,
  PartitionConfig,
  isPartitionConfig,
  generate as generatePartition,
} from "~/storage/model/config/partition";
import { SpacePolicy, generate as generateSpacePolicy } from "~/storage/model/config/space-policy";
import { generateName, generateFilesystem, generateSnapshots } from "~/storage/model/config/common";

export type Drive = {
  index?: number;
  name?: string;
  alias?: string;
  filesystem?: string;
  mountPath?: string;
  snapshots?: boolean;
  spacePolicy?: SpacePolicy;
  partitions?: Partition[];
};

class DriveGenerator {
  private driveConfig: config.DriveElement | undefined;
  private solvedDriveConfig: config.DriveElement;

  constructor(
    driveConfig: config.DriveElement | undefined,
    solvedDriveConfig: config.DriveElement,
  ) {
    this.driveConfig = driveConfig;
    this.solvedDriveConfig = solvedDriveConfig;
  }

  generate(): Drive {
    if (checks.isFormattedDrive(this.solvedDriveConfig)) {
      return this.fromFormattedDrive(this.solvedDriveConfig);
    } else if (checks.isPartitionedDrive(this.solvedDriveConfig)) {
      return this.fromPartitionedDrive(this.solvedDriveConfig);
    }
  }

  private fromFormattedDrive(solvedDriveConfig: config.FormattedDrive): Drive {
    return {
      index: solvedDriveConfig.index,
      name: generateName(solvedDriveConfig),
      alias: solvedDriveConfig.alias,
      spacePolicy: this.generateSpacePolicy(),
      filesystem: generateFilesystem(solvedDriveConfig),
      mountPath: solvedDriveConfig.filesystem?.path,
      snapshots: generateSnapshots(solvedDriveConfig),
    };
  }

  private fromPartitionedDrive(solvedDriveConfig: config.PartitionedDrive): Drive {
    return {
      index: solvedDriveConfig.index,
      name: generateName(solvedDriveConfig),
      alias: solvedDriveConfig.alias,
      spacePolicy: this.generateSpacePolicy(),
      partitions: this.generatePartitions(solvedDriveConfig),
    };
  }

  private generateSpacePolicy(): SpacePolicy {
    if (this.driveConfig === undefined) return;

    return generateSpacePolicy(this.driveConfig);
  }

  private generatePartitions(solvedDriveConfig: config.PartitionedDrive): Partition[] {
    const solvedPartitionConfigs = solvedDriveConfig.partitions || [];
    return solvedPartitionConfigs.filter(isPartitionConfig).map((c) => this.generatePartition(c));
  }

  private generatePartition(solvedPartitionConfig: PartitionConfig): Partition {
    let partitionConfig: config.PartitionElement | undefined;

    if (this.driveConfig !== undefined && checks.isPartitionedDrive(this.driveConfig)) {
      const partitionConfigs = this.driveConfig.partitions || [];
      partitionConfig = partitionConfigs[solvedPartitionConfig.index];
    }

    return generatePartition(partitionConfig, solvedPartitionConfig);
  }
}

export function generate(
  driveConfig: config.DriveElement | undefined,
  solvedDriveConfig: config.DriveElement,
): Drive {
  const generator = new DriveGenerator(driveConfig, solvedDriveConfig);
  return generator.generate();
}
