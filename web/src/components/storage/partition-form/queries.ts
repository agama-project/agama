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

/**
 * Query hooks for the partition form.
 *
 * These compose route params with config model queries to derive the data the
 * form needs. They feed both the form's default values and field options, so
 * they live in one place to avoid duplication.
 */

import { useParams } from "react-router";
import { createPartitionableLocation } from "~/components/storage/utils";
import { useDevice } from "~/hooks/model/system/storage";
import { useMissingMountPaths, usePartitionable } from "~/hooks/model/storage/config-model";
import configModel from "~/model/storage/config-model";
import { compact } from "~/utils";

import type { ConfigModel, Partitionable } from "~/model/storage/config-model";
import type { Storage as System } from "~/model/system";

/**
 * Resolves the partitionable device model from the current route params.
 *
 * Calls `usePartitionable` unconditionally (hook rules) with safe fallback
 * values when the location cannot be parsed, then returns `null` if the route
 * params do not map to a valid partitionable location.
 */
export function useDeviceModelFromParams(): Partitionable.Device | null {
  const { collection, index } = useParams();
  const location = createPartitionableLocation(collection, index);
  // Call hook unconditionally, but pass safe defaults if location is null
  const device = usePartitionable(
    location?.collection || "drives",
    location?.index !== undefined ? location.index : 0,
  );
  return location ? device : null;
}

/**
 * Returns the existing partition config being edited, or null when creating a
 * new partition.
 *
 * The `partitionId` route param holds the mount path used to look up the
 * partition within the device resolved by useDeviceModelFromParams.
 */
export function useInitialPartitionConfig(): ConfigModel.Partition | null {
  const { partitionId: mountPath } = useParams();
  const device = useDeviceModelFromParams();
  return mountPath && device ? configModel.partitionable.findPartition(device, mountPath) : null;
}

/** Unused predefined mount points. Includes the current one when editing. */
export function useUnusedMountPoints(): string[] {
  const unusedMountPaths = useMissingMountPaths();
  const initialPartitionConfig = useInitialPartitionConfig();
  return compact([initialPartitionConfig?.mountPath, ...unusedMountPaths]);
}

/** Unused partitions available to reuse. Includes the current one when editing. */
export function useUnusedPartitions(): System.Device[] {
  const deviceModel = useDeviceModelFromParams();
  const systemDevice = useDevice(deviceModel?.name || "");
  const initialPartitionConfig = useInitialPartitionConfig();

  if (!deviceModel || !systemDevice) return [];

  const allPartitions = systemDevice.partitions || [];
  const configuredPartitionConfigs = configModel.partitionable
    .filterConfiguredExistingPartitions(deviceModel)
    .filter((p) => p.name !== initialPartitionConfig?.name)
    .map((p) => p.name);

  return allPartitions.filter((p) => !configuredPartitionConfigs.includes(p.name));
}
