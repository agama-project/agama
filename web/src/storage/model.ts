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

export type Drive = {
  name: string;
  alias?: string;
  partitions?: Partition[];
};

export type Partition = {
  name?: string;
  alias?: string;
  delete?: boolean;
  deleteIfNeeded?: boolean;
};

type PartitionConfig =
  | config.Partition
  | config.PartitionToDelete
  | config.PartitionToDeleteIfNeeded;

function isPartitionConfig(partition: config.PartitionElement): partition is PartitionConfig {
  return (
    checks.isPartition(partition) ||
    checks.isPartitionToDelete(partition) ||
    checks.isPartitionToDeleteIfNeeded(partition)
  );
}

function nameFromSearch({ search }: { search: config.Search | undefined }): string | undefined {
  if (!checks.isAdvancedSearch(search) || !search?.condition) return;

  return search.condition.name;
}

class PartitionGenerator {
  private partitionConfig: PartitionConfig;

  constructor(partitionConfig: PartitionConfig) {
    this.partitionConfig = partitionConfig;
  }

  generate(): Partition {
    if (checks.isPartition(this.partitionConfig)) {
      return this.fromPartition(this.partitionConfig);
    } else if (checks.isPartitionToDelete(this.partitionConfig)) {
      return this.fromPartitionToDelete(this.partitionConfig);
    } else if (checks.isPartitionToDeleteIfNeeded(this.partitionConfig)) {
      return this.fromPartitionToDeleteIfNeeded(this.partitionConfig);
    }
  }

  private fromPartition(partitionConfig: config.Partition): Partition {
    return {
      alias: partitionConfig.alias,
    };
  }

  private fromPartitionToDelete(partitionConfig: config.PartitionToDelete): Partition {
    return {
      name: nameFromSearch({ search: partitionConfig.search }),
      delete: true,
    };
  }

  private fromPartitionToDeleteIfNeeded(
    partitionConfig: config.PartitionToDeleteIfNeeded,
  ): Partition {
    return {
      name: nameFromSearch({ search: partitionConfig.search }),
      deleteIfNeeded: true,
    };
  }
}

class DriveGenerator {
  private driveConfig: config.DriveElement;

  constructor(driveConfig: config.DriveElement) {
    this.driveConfig = driveConfig;
  }

  generate(): Drive {
    return {
      name: nameFromSearch({ search: this.driveConfig.search }),
      alias: this.driveConfig.alias,
      partitions: this.generatePartitions(),
    };
  }

  private generatePartitions(): Partition[] {
    if (checks.isFormattedDrive(this.driveConfig)) return [];

    const configs = this.driveConfig.partitions || [];
    return configs
      .filter((c) => isPartitionConfig(c))
      .map((c) => new PartitionGenerator(c).generate());
  }
}

class DevicesGenerator {
  private config: config.Config;
  private solvedConfig: config.Config;

  constructor(config: config.Config, solvedConfig: config.Config) {
    this.config = config;
    this.solvedConfig = solvedConfig;
  }

  generate(): Drive[] {
    return this.generateDrives();
  }

  private generateDrives(): Drive[] {
    const configs = this.solvedConfig.drives || [];
    return configs.map((c) => new DriveGenerator(c).generate());
  }
}

export function generateDevices(config: config.Config, solvedConfig: config.Config): Drive[] {
  const generator = new DevicesGenerator(config, solvedConfig);
  return generator.generate();
}
