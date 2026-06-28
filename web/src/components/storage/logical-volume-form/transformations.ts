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
 * Transformation functions for the logical volume form.
 *
 * This module handles conversion between logical volume ConfigModel types and
 * form field values. It provides:
 *
 * - **buildPayload**: Converts form values to ConfigModel.LogicalVolume for API mutations
 * - **toFormValues**: Converts ConfigModel.LogicalVolume to initial form values
 * - **useSolvedSizes**: Calculates min/max sizes by querying the backend solver
 * - **lvNameFromMountPoint**: Derives LV name from mount point (auto-fill helper)
 *
 * ## Data Flow
 *
 * ```
 * Initial load:
 *   ConfigModel.LogicalVolume → toFormValues() → FormValues → TanStack Form state
 *
 * Form submission:
 *   TanStack Form state → FormValues → buildPayload() → ConfigModel.LogicalVolume → API
 *
 * Size hints (during editing):
 *   FormValues (mount point, filesystem) → useSolvedSizes() → { min, max } → UI
 *
 * LV name auto-fill:
 *   mount point → lvNameFromMountPoint() → lvName field (until user edits manually)
 * ```
 *
 * ## Shared Helpers
 *
 * This module uses generic transformation helpers from shared/transformations.ts
 * for filesystem and size configuration. Form-specific logic handles:
 *
 * - The `target` field (name of LV to reuse)
 * - The `lvName` field (name for new LVs)
 * - LV name auto-fill from mount point
 *
 * @see shared/transformations.ts
 */

import { useParams } from "react-router";
import { useConfigModel, useSolvedConfigModel } from "~/hooks/model/storage/config-model";
import configModel from "~/model/storage/config-model";
import { deviceSize } from "~/components/storage/utils";
import {
  buildFilesystemConfig,
  buildSizeConfig,
  inferSizeFields,
  fsConfigValue,
} from "~/components/storage/shared/transformations";
import { useVolumeGroupConfig, useInitialLogicalVolumeConfig } from "./queries";
import {
  FILESYSTEM_TYPE,
  FILESYSTEM_ACTION,
  isReusingLogicalVolume,
  defaultOptions,
} from "./fields";
import type { SolvedSizes } from "~/components/storage/shared/SizeFields";
import type { ConfigModel } from "~/model/storage/config-model";

/**
 * Derives a logical volume name from a mount point.
 *
 * Used for auto-filling the lvName field when the user selects a mount point.
 * The auto-fill stops once the user manually edits the lvName field.
 *
 * Mimics the heuristic the backend applies when planning a logical volume
 * (Y2Storage::Planned::LvmLv), so the suggested name matches what the
 * installer would pick on its own.
 *
 * ## Transformation Rules
 *
 * - "/" → "root"
 * - "swap" → "swap"
 * - Path like "/home" → "home"
 * - Path like "/var/lib" → "var_lib" (slashes become underscores)
 * - Anything else (including an empty mount point) → empty name
 *
 * This follows LVM naming conventions where logical volume names are plain
 * identifiers without path separators.
 *
 * @see https://github.com/yast/yast-storage-ng/blob/a4f6631bc244aadfe40e47ca8959aad2870d74e8/src/lib/y2storage/planned/lvm_lv.rb#L96-L105
 *
 * @param mountPoint - The mount point to derive a name from
 * @returns Suggested logical volume name
 *
 * @example
 * lvNameFromMountPoint("/")
 * // → "root"
 *
 * @example
 * lvNameFromMountPoint("/home")
 * // → "home"
 *
 * @example
 * lvNameFromMountPoint("/var/lib/mysql")
 * // → "var_lib_mysql"
 *
 * @example
 * lvNameFromMountPoint("swap")
 * // → "swap"
 *
 * @example
 * lvNameFromMountPoint("")
 * // → ""
 */
export function lvNameFromMountPoint(mountPoint: string): string {
  if (mountPoint === "/") return "root";
  if (mountPoint === "swap") return "swap";
  if (!mountPoint.startsWith("/")) return "";
  return mountPoint.replace(/^\//, "").replace(/\//g, "_");
}

/**
 * Builds a logical volume configuration from validated form values.
 *
 * Converts the form's field values into a ConfigModel.LogicalVolume structure
 * suitable for API mutations (add/edit logical volume).
 *
 * ## Field Mapping
 *
 * - **mountPath**: Directly from mountPoint field
 * - **lvName**: Logical volume name for new LVs (omitted when reusing)
 * - **name**: Set only when reusing an existing logical volume (from target field)
 * - **filesystem**: Built using shared helper, handles REUSE/AUTO/explicit type
 * - **size**: Built using shared helper, handles AUTO/FIXED/RANGE/EXPAND modes
 *
 * ## Reuse vs Create
 *
 * The form has two "name" fields:
 * - `target`: name of existing LV to reuse (e.g., "lv_home")
 * - `lvName`: name for new LV being created (e.g., "home")
 *
 * Only one is set in the payload:
 * - Reusing: `name = target`, `lvName = undefined`
 * - Creating: `name = undefined`, `lvName = lvName`
 *
 * @param values - Validated form field values
 * @returns Logical volume configuration ready for API mutation
 *
 * @example
 * // Create new logical volume
 * buildPayload({
 *   mountPoint: "/home",
 *   target: "",  // empty = creating new
 *   lvName: "home",
 *   filesystem: "xfs",
 *   sizeMode: "fixed",
 *   fixedSize: "50 GiB",
 *   ...
 * })
 * // → {
 * //     mountPath: "/home",
 * //     lvName: "home",
 * //     name: undefined,
 * //     filesystem: { default: false, type: "xfs" },
 * //     size: { default: false, min: 53687091200, max: 53687091200 }
 * //   }
 *
 * @example
 * // Reuse existing logical volume
 * buildPayload({
 *   mountPoint: "/var",
 *   target: "lv_var",  // non-empty = reusing existing
 *   lvName: "",
 *   filesystem: "reuse",
 *   ...
 * })
 * // → {
 * //     mountPath: "/var",
 * //     lvName: "",
 * //     name: "lv_var",
 * //     filesystem: { reuse: true, default: true },
 * //     size: undefined
 * //   }
 */
export function buildPayload(
  values: typeof defaultOptions.defaultValues,
): ConfigModel.LogicalVolume {
  const isReuse = isReusingLogicalVolume(values.target);

  return {
    mountPath: values.mountPoint,
    lvName: isReuse ? undefined : values.lvName,
    name: isReuse ? values.target : undefined,
    filesystem: buildFilesystemConfig(values),
    size: buildSizeConfig(values),
  };
}

/**
 * Maps a stored logical volume configuration to initial form values.
 *
 * Converts a ConfigModel.LogicalVolume (from the backend) into the field values
 * needed to initialize the form. This is the inverse of buildPayload.
 *
 * Returns an empty object when creating a new logical volume (config is null),
 * which allows form defaults to take precedence.
 *
 * ## Filesystem Action Detection
 *
 * When editing a reused logical volume with a filesystem, defaults to REUSE
 * (keep existing filesystem) unless the config explicitly says reuse: false.
 *
 * ## Size Field Inference
 *
 * Uses the shared inferSizeFields helper to reconstruct size mode and values
 * from the stored min/max bytes. Reused logical volumes always show AUTO mode.
 *
 * ## Extra Filesystem Settings
 *
 * The showMoreFilesystemSettings checkbox is pre-checked when any of label,
 * mkfsExtraArguments, or mountOptions are non-empty in the stored config.
 *
 * @param logicalVolumeConfig - LV config from backend, or null for new LV
 * @returns Partial form values to merge with defaults
 *
 * @example
 * // Editing existing logical volume
 * toFormValues({
 *   mountPath: "/home",
 *   name: "lv_home",
 *   lvName: "home",
 *   filesystem: { type: "xfs", label: "home-data" },
 *   size: { default: false, min: 53687091200, max: 53687091200 }
 * })
 * // → {
 * //     mountPoint: "/home",
 * //     committedMountPoint: "/home",
 * //     target: "lv_home",
 * //     lvName: "home",
 * //     filesystem: "reuse",  // default to keeping existing
 * //     filesystemAction: "reuse",
 * //     filesystemLabel: "home-data",
 * //     showMoreFilesystemSettings: true,
 * //     sizeMode: "auto",  // reuse always shows AUTO
 * //     ...
 * //   }
 *
 * @example
 * // Creating new logical volume
 * toFormValues(null)
 * // → {}  (form defaults take precedence)
 */
export function toFormValues(
  logicalVolumeConfig: ConfigModel.LogicalVolume | null,
): Partial<typeof defaultOptions.defaultValues> {
  if (!logicalVolumeConfig) return {};

  const fsConfig = logicalVolumeConfig.filesystem;
  const isReuse = logicalVolumeConfig.name !== undefined;

  // When editing a reused logical volume, default to keeping the filesystem
  // when the config explicitly says so (reuse: true, the stored form of the
  // "Current" choice, which carries no type) or when it has a type and does
  // not explicitly ask for formatting (reuse: false)
  const keepsByConfig = fsConfig?.reuse === true;
  const keepsByType = fsConfig?.type !== undefined && fsConfig?.reuse !== false;
  const shouldKeepFilesystem = isReuse && (keepsByConfig || keepsByType);

  const mountPoint = logicalVolumeConfig.mountPath || "";
  const filesystemLabel = fsConfig?.label || "";
  const mkfsExtraArguments = fsConfig?.mkfsExtraArguments || "";
  const mountOptions = fsConfig?.mountOptions || [];
  const showMoreFilesystemSettings =
    filesystemLabel !== "" || mkfsExtraArguments !== "" || !!mountOptions.length;

  return {
    mountPoint,
    committedMountPoint: mountPoint,
    target: logicalVolumeConfig.name || "",
    lvName: logicalVolumeConfig.lvName || "",
    filesystem: shouldKeepFilesystem ? FILESYSTEM_ACTION.REUSE : fsConfigValue(fsConfig),
    filesystemAction: shouldKeepFilesystem ? FILESYSTEM_ACTION.REUSE : FILESYSTEM_ACTION.FORMAT,
    filesystemLabel,
    mkfsExtraArguments,
    mountOptions,
    showMoreFilesystemSettings,
    ...inferSizeFields(logicalVolumeConfig),
  };
}

/**
 * Builds a sparse logical volume config for size calculation.
 *
 * Creates a minimal logical volume configuration with:
 * - The current mount point
 * - The selected filesystem (or undefined when AUTO, letting solver choose)
 * - Size omitted (forces automatic calculation)
 * - Name and lvName stripped (irrelevant for size solving)
 * - Always treated as a new logical volume
 *
 * This sparse config is sent to the backend solver to calculate min/max sizes
 * based on the volume template and available space in the volume group.
 *
 * @param mountPoint - Current mount point field value
 * @param filesystem - Current filesystem field value (including AUTO)
 * @returns Complete ConfigModel with the sparse logical volume, or undefined
 *   if mount point is empty
 */
function useSparseModel(mountPoint: string, filesystem: string): ConfigModel.Config | undefined {
  const { id } = useParams();
  const index = Number(id);
  const config = useConfigModel();
  const volumeGroupConfig = useVolumeGroupConfig();
  const initialLogicalVolumeConfig = useInitialLogicalVolumeConfig();

  if (!config || !volumeGroupConfig) return undefined;

  // Sizes are only solved for new logical volumes with a mount point
  if (mountPoint === "" || filesystem === "") {
    return undefined;
  }

  const logicalVolumeConfig: ConfigModel.LogicalVolume = {
    mountPath: mountPoint,
    name: undefined, // Always treat as new logical volume for size calculation
    lvName: undefined,
    filesystem:
      filesystem === FILESYSTEM_TYPE.AUTO
        ? undefined
        : {
            default: false,
            type: filesystem as ConfigModel.FilesystemType,
            label: undefined,
          },
    size: undefined, // Force automatic sizing
  };

  return initialLogicalVolumeConfig
    ? configModel.logicalVolume.edit(
        config,
        index,
        initialLogicalVolumeConfig.mountPath,
        logicalVolumeConfig,
      )
    : configModel.logicalVolume.add(config, index, logicalVolumeConfig);
}

/**
 * Calculates solved sizes for a logical volume configuration.
 *
 * This hook is passed to the shared SizeFields component, which calls it
 * whenever the committed mount point or filesystem changes. The backend solver
 * determines min/max sizes based on:
 *
 * - Volume template for the mount point (if any)
 * - Available space in the volume group
 * - Filesystem overhead
 *
 * ## When Sizes Are Calculated
 *
 * For new logical volumes with a mount point. Works with both AUTO and explicit
 * filesystem types. Returns null when:
 * - Mount point is empty (no template to consult)
 * - Backend solver returns no size config
 *
 * ## Usage
 *
 * ```typescript
 * <SizeFields form={form} useSolvedSizes={useSolvedSizes} />
 * ```
 *
 * The SizeFields component displays the solved sizes as hints to the user
 * and uses them to validate manual size inputs.
 *
 * @param mountPoint - Current committedMountPoint value (only recalculates when this changes)
 * @param filesystem - Current filesystem value
 * @returns Object with min/max size strings, or null if sizes cannot be calculated
 *
 * @example
 * // New /home logical volume with XFS
 * useSolvedSizes("/home", "xfs")
 * // → { min: "10 GiB", max: "500 GiB" }
 *
 * @example
 * // Filesystem not selected yet
 * useSolvedSizes("/var", "auto")
 * // → null
 *
 * @example
 * // Backend solver returns no size
 * useSolvedSizes("/custom", "ext4")
 * // → null  (no volume template for /custom)
 */
export function useSolvedSizes(mountPoint: string, filesystem: string): SolvedSizes {
  const volumeGroupConfig = useVolumeGroupConfig();
  const sparseModel = useSparseModel(mountPoint, filesystem);
  const solvedModel = useSolvedConfigModel(sparseModel);

  if (!solvedModel || !volumeGroupConfig) return null;

  const solvedVolumeGroupConfig = configModel.volumeGroup.findByName(
    solvedModel,
    volumeGroupConfig.vgName,
  );
  const solvedLogicalVolume = configModel.device.findVolumeByMountPath(
    solvedVolumeGroupConfig,
    mountPoint,
  );

  const size = solvedLogicalVolume?.size;
  if (!size) return null;

  return {
    min: size.min ? deviceSize(size.min) : undefined,
    max: size.max ? deviceSize(size.max) : undefined,
  };
}
