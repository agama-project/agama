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
 * Query hooks for the logical volume form.
 *
 * These compose route params with config model queries to derive the data the
 * form needs. They feed both the form's default values and field options, so
 * they live in one place to avoid duplication.
 */

import { useParams } from "react-router";
import { useDevice } from "~/hooks/model/system/storage";
import {
  useMissingMountPaths,
  useVolumeGroup as useConfigModelVolumeGroup,
} from "~/hooks/model/storage/config-model";
import configModel from "~/model/storage/config-model";
import { compact } from "~/utils";

import type { ConfigModel } from "~/model/storage/config-model";
import type { Storage as System } from "~/model/system";

/** Logical volumes already configured (reused or kept by the space policy). */
function configuredLogicalVolumes(
  volumeGroupConfig: ConfigModel.VolumeGroup,
): ConfigModel.LogicalVolume[] {
  if (volumeGroupConfig.spacePolicy === "custom")
    return volumeGroupConfig.logicalVolumes.filter(
      (l) =>
        !configModel.volume.isNew(l) &&
        (configModel.volume.isUsed(l) || configModel.volume.isUsedBySpacePolicy(l)),
    );

  return volumeGroupConfig.logicalVolumes.filter(configModel.volume.isReused);
}

/** Volume group config resolved from the `id` route param, or null. */
export function useVolumeGroupConfig(): ConfigModel.VolumeGroup | null {
  const { id: index } = useParams();
  return useConfigModelVolumeGroup(Number(index)) ?? null;
}

/**
 * The volume group as it exists in the system, or undefined when it is new (not
 * yet created as part of this configuration).
 */
export function useVolumeGroup(): System.Device | undefined {
  const volumeGroupConfig = useVolumeGroupConfig();
  return useDevice(volumeGroupConfig?.name);
}

/** The logical volume config being edited, or null when creating a new one. */
export function useInitialLogicalVolumeConfig(): ConfigModel.LogicalVolume | null {
  const { logicalVolumeId: mountPath } = useParams();
  const volumeGroupConfig = useVolumeGroupConfig();
  if (!volumeGroupConfig || !mountPath) return null;

  const logicalVolume = volumeGroupConfig.logicalVolumes.find((l) => l.mountPath === mountPath);
  return logicalVolume || null;
}

/** Unused predefined mount points. Includes the current one when editing. */
export function useUnusedMountPoints(): string[] {
  const unusedMountPaths = useMissingMountPaths();
  const initialLogicalVolumeConfig = useInitialLogicalVolumeConfig();
  return compact([initialLogicalVolumeConfig?.mountPath, ...unusedMountPaths]);
}

/** Unused logical volumes available to reuse. Includes the current one when editing. */
export function useUnusedLogicalVolumes(): System.Device[] {
  const volumeGroup = useVolumeGroup();
  const volumeGroupConfig = useVolumeGroupConfig();
  const initialLogicalVolumeConfig = useInitialLogicalVolumeConfig();

  if (!volumeGroup || !volumeGroupConfig) return [];

  const allLogicalVolumes = volumeGroup.logicalVolumes || [];
  const configuredNames = configuredLogicalVolumes(volumeGroupConfig)
    .filter((l) => l.name !== initialLogicalVolumeConfig?.name)
    .map((l) => l.name);

  return allLogicalVolumes.filter((l) => !configuredNames.includes(l.name));
}
