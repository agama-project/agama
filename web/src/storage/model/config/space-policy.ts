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

export type SpacePolicy = "keep" | "resize" | "delete" | "custom";

class SpacePolicyGenerator {
  private driveConfig: config.DriveElement;

  constructor(driveConfig: config.DriveElement) {
    this.driveConfig = driveConfig;
  }

  generate(): SpacePolicy {
    if (this.isDeletePolicy()) return "delete";
    if (this.isResizePolicy()) return "resize";
    if (this.isCustomPolicy()) return "custom";

    return "keep";
  }

  private isDeletePolicy(): boolean {
    return checks.isFormattedDrive(this.driveConfig) || this.hasDeleteAllPartition();
  }

  private isResizePolicy(): boolean {
    return this.hasResizeAllPartition();
  }

  private isCustomPolicy(): boolean {
    return this.hasDeletePartition() || this.hasResizePartition();
  }

  private hasDeleteAllPartition(): boolean {
    const deleteAllPartition = this.partitionConfigs().find((c) => this.isDeleteAllPartition(c));
    return deleteAllPartition !== undefined;
  }

  private hasDeletePartition(): boolean {
    const deletePartition = this.partitionConfigs().find((c) => this.isDeletePartition(c));
    return deletePartition !== undefined;
  }

  private hasResizeAllPartition(): boolean {
    const resizeAllPartition = this.partitionConfigs().find((c) => this.isResizeAllPartition(c));
    return resizeAllPartition !== undefined;
  }

  private hasResizePartition(): boolean {
    const resizePartition = this.partitionConfigs().find((c) => this.isResizePartition(c));
    return resizePartition !== undefined;
  }

  private isDeleteAllPartition(partitionConfig: config.PartitionElement): boolean {
    return checks.isPartitionToDelete(partitionConfig) && this.isSearchAll(partitionConfig.search);
  }

  private isDeletePartition(partitionConfig: config.PartitionElement): boolean {
    const isDelete =
      checks.isPartitionToDelete(partitionConfig) ||
      checks.isPartitionToDeleteIfNeeded(partitionConfig);

    return isDelete && !this.isDeleteAllPartition(partitionConfig);
  }

  private isResizeAllPartition(partitionConfig: config.PartitionElement): boolean {
    return (
      checks.isPartition(partitionConfig) &&
      partitionConfig.search &&
      this.isSearchAll(partitionConfig.search) &&
      partitionConfig.size &&
      this.isShrinkAllSize(partitionConfig.size)
    );
  }

  // TODO: if the size is not a range, then detect resize partitions by comparing with the size of
  //  the system device.
  private isResizePartition(partitionConfig: config.PartitionElement): boolean {
    if (!checks.isPartition(partitionConfig)) return false;

    return (
      !this.isResizeAllPartition(partitionConfig) &&
      partitionConfig.search &&
      partitionConfig.size &&
      this.isResizeSize(partitionConfig.size)
    );
  }

  private isSearchAll(searchConfig: config.Search): boolean {
    const isAdvancedSearchAll =
      checks.isAdvancedSearch(searchConfig) &&
      !searchConfig.condition &&
      !searchConfig.max &&
      searchConfig.ifNotFound === "skip";

    return isAdvancedSearchAll || checks.isSearchAll(searchConfig);
  }

  private isShrinkAllSize(sizeConfig: config.Size): boolean {
    if (!this.isResizeSize(sizeConfig)) return false;

    return (
      (checks.isSizeTuple(sizeConfig) &&
        sizeConfig[0] === 0 &&
        sizeConfig[1] &&
        checks.isSizeCurrent(sizeConfig[1])) ||
      (checks.isSizeRange(sizeConfig) &&
        sizeConfig.min === 0 &&
        sizeConfig.max &&
        checks.isSizeCurrent(sizeConfig.max))
    );
  }

  private isResizeSize(sizeConfig: config.Size): boolean {
    if (checks.isSizeBytes(sizeConfig)) return false;
    if (checks.isSizeString(sizeConfig)) return false;
    if (checks.isSizeTuple(sizeConfig)) return sizeConfig[0] !== sizeConfig[1];
    if (checks.isSizeRange(sizeConfig)) return sizeConfig.min !== sizeConfig.max;
  }

  private partitionConfigs(): config.PartitionElement[] {
    if (checks.isFormattedDrive(this.driveConfig)) return [];

    return this.driveConfig.partitions || [];
  }
}

export function generate(config: config.DriveElement): SpacePolicy {
  const generator = new SpacePolicyGenerator(config);
  return generator.generate();
}
