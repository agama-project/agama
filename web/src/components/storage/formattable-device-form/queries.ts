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
 * Data hooks for the formattable device form.
 *
 * These resolve the device model (drive or MD RAID) from the route params and
 * the config model. They feed the form's default values and field options, so
 * they live in one place to avoid duplication.
 */

import { useParams } from "react-router";
import { useDevice } from "~/hooks/model/system/storage";
import { useMissingMountPaths, usePartitionable } from "~/hooks/model/storage/config-model";
import { createPartitionableLocation } from "~/components/storage/utils";
import { compact } from "~/utils";

import type { Partitionable } from "~/model/storage/config-model";
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
  const deviceModel = usePartitionable(
    location?.collection || "drives",
    location?.index !== undefined ? location.index : 0,
  );
  return location ? deviceModel : null;
}

/** The device as it exists in the system, or undefined when not found. */
export function useDeviceFromParams(): System.Device | undefined {
  const deviceModel = useDeviceModelFromParams();
  return useDevice(deviceModel?.name);
}

/** Unused predefined mount points. Includes the currently used mount point when editing. */
export function useUnusedMountPoints(): string[] {
  const unusedMountPaths = useMissingMountPaths();
  const deviceModel = useDeviceModelFromParams();
  return compact([deviceModel?.mountPath, ...unusedMountPaths]);
}
