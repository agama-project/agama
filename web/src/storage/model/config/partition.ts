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
import { Size, generate as generateSize } from "~/storage/model/config/size";
import { generateName, generateFilesystem, generateSnapshots } from "~/storage/model/config/common";

export type Partition = {
  index?: number;
  name?: string;
  alias?: string;
  delete?: boolean;
  deleteIfNeeded?: boolean;
  resize?: boolean;
  resizeIfNeeded?: boolean;
  filesystem?: string;
  mountPath?: string;
  snapshots?: boolean;
  size?: Size;
};

export type PartitionConfig =
  | config.RegularPartition
  | config.PartitionToDelete
  | config.PartitionToDeleteIfNeeded;

export function isPartitionConfig(
  partition: config.PartitionElement,
): partition is PartitionConfig {
  return (
    checks.isRegularPartition(partition) ||
    checks.isPartitionToDelete(partition) ||
    checks.isPartitionToDeleteIfNeeded(partition)
  );
}

type PartitionWithSizeConfig = config.RegularPartition | config.PartitionToDeleteIfNeeded;

function isPartitionWithSizeConfig(
  partition: config.PartitionElement,
): partition is PartitionWithSizeConfig {
  return checks.isRegularPartition(partition) || checks.isPartitionToDeleteIfNeeded(partition);
}

class PartitionGenerator {
  private partitionConfig: config.PartitionElement | undefined;
  private solvedPartitionConfig: PartitionConfig;

  constructor(
    partitionConfig: config.PartitionElement | undefined,
    solvedPartitionConfig: PartitionConfig,
  ) {
    this.partitionConfig = partitionConfig;
    this.solvedPartitionConfig = solvedPartitionConfig;
  }

  generate(): Partition {
    if (checks.isRegularPartition(this.solvedPartitionConfig)) {
      return this.fromRegularPartition(this.solvedPartitionConfig);
    } else if (checks.isPartitionToDelete(this.solvedPartitionConfig)) {
      return this.fromPartitionToDelete(this.solvedPartitionConfig);
    } else if (checks.isPartitionToDeleteIfNeeded(this.solvedPartitionConfig)) {
      return this.fromPartitionToDeleteIfNeeded(this.solvedPartitionConfig);
    }
  }

  private fromRegularPartition(solvedPartitionConfig: config.RegularPartition): Partition {
    return {
      index: this.solvedPartitionConfig.index,
      name: generateName(solvedPartitionConfig),
      alias: solvedPartitionConfig.alias,
      resize: this.generateResize(),
      resizeIfNeeded: this.generateResizeIfNeeded(),
      filesystem: generateFilesystem(solvedPartitionConfig),
      mountPath: solvedPartitionConfig.filesystem?.path,
      snapshots: generateSnapshots(solvedPartitionConfig),
      size: this.generateSize(),
    };
  }

  private fromPartitionToDelete(solvedPartitionConfig: config.PartitionToDelete): Partition {
    return {
      index: this.solvedPartitionConfig.index,
      name: generateName(solvedPartitionConfig),
      delete: true,
    };
  }

  private fromPartitionToDeleteIfNeeded(
    solvedPartitionConfig: config.PartitionToDeleteIfNeeded,
  ): Partition {
    return {
      index: this.solvedPartitionConfig.index,
      name: generateName(solvedPartitionConfig),
      deleteIfNeeded: true,
      resize: this.generateResize(),
      resizeIfNeeded: this.generateResizeIfNeeded(),
      size: this.generateSize(),
    };
  }

  private generateSize(): Size | undefined {
    if (!isPartitionWithSizeConfig(this.solvedPartitionConfig)) return;

    return generateSize(this.partitionConfig, this.solvedPartitionConfig);
  }

  // TODO: return false if the size is equal to the size of the system device.
  private generateResize(): boolean | undefined {
    if (this.solvedPartitionConfig.search === undefined) return;

    const size = this.generateSize();
    return size !== undefined && !size.auto && size.min !== undefined && size.min === size.max;
  }

  private generateResizeIfNeeded(): boolean | undefined {
    if (this.solvedPartitionConfig.search === undefined) return;

    const size = this.generateSize();
    return size !== undefined && !size.auto && size.min !== size.max;
  }
}

export function generate(
  partitionConfig: config.PartitionElement | undefined,
  solvedPartitionConfig: PartitionConfig,
): Partition {
  const generator = new PartitionGenerator(partitionConfig, solvedPartitionConfig);
  return generator.generate();
}
