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
import { Size, WithSize, generate as generateSize } from "~/storage/model/config/size";
import { generateName, generateFilesystem, generateSnapshots } from "~/storage/model/config/common";

export type Partition = {
  name?: string;
  alias?: string;
  delete?: boolean;
  deleteIfNeeded?: boolean;
  resizeIfNeeded?: boolean;
  filesystem?: string;
  mountPath?: string;
  snapshots?: boolean;
  size?: Size;
};

export type PartitionConfig =
  | config.Partition
  | config.PartitionToDelete
  | config.PartitionToDeleteIfNeeded;

export function isPartitionConfig(
  partition: config.PartitionElement,
): partition is PartitionConfig {
  return (
    checks.isPartition(partition) ||
    checks.isPartitionToDelete(partition) ||
    checks.isPartitionToDeleteIfNeeded(partition)
  );
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
      name: generateName(partitionConfig),
      alias: partitionConfig.alias,
      resizeIfNeeded: this.generateResizeIfNeeded(partitionConfig),
      filesystem: generateFilesystem(partitionConfig),
      mountPath: partitionConfig.filesystem?.path,
      snapshots: generateSnapshots(partitionConfig),
      size: generateSize(partitionConfig),
    };
  }

  private fromPartitionToDelete(partitionConfig: config.PartitionToDelete): Partition {
    return {
      name: generateName(partitionConfig),
      delete: true,
    };
  }

  private fromPartitionToDeleteIfNeeded(
    partitionConfig: config.PartitionToDeleteIfNeeded,
  ): Partition {
    return {
      name: generateName(partitionConfig),
      deleteIfNeeded: true,
      resizeIfNeeded: this.generateResizeIfNeeded(partitionConfig),
      size: generateSize(partitionConfig),
    };
  }

  private generateResizeIfNeeded<TypeWithSize extends WithSize>(
    partitionConfig: TypeWithSize,
  ): boolean | undefined {
    if (!partitionConfig.size) return;

    const size = generateSize(partitionConfig);
    return size.min !== undefined && size.min !== size.max;
  }
}

export function generate(config: PartitionConfig): Partition {
  const generator = new PartitionGenerator(config);
  return generator.generate();
}
