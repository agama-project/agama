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
 * Shared transformation helpers for storage forms.
 *
 * This module provides generic functions for converting between form field
 * values and ConfigModel data structures. These helpers work with field
 * structures common to both partition-form and logical-volume-form:
 *
 * - Filesystem configuration (type, label, mount/mkfs options)
 * - Size configuration (auto, fixed, range, expand modes)
 *
 * ## Usage
 *
 * Form-specific transformation modules import these helpers to build complete
 * payloads and initial values. The helpers handle the repetitive mapping logic
 * while form-specific code adds device-type-specific fields.
 *
 * Example from partition-form/transformations.ts:
 * ```typescript
 * function buildPayload(values: FormValues): ConfigModel.Partition {
 *   return {
 *     mountPath: values.mountPoint,
 *     name: isReuse ? values.name : undefined,
 *     filesystem: buildFilesystemConfig(values),  // ← shared helper
 *     size: buildSizeConfig(values),              // ← shared helper
 *   };
 * }
 * ```
 *
 * @see partition-form/transformations.ts
 * @see logical-volume-form/transformations.ts
 */

import { isEmpty } from "radashi";
import { deviceSize, parseToBytes } from "~/components/storage/utils";
import { FILESYSTEM_TYPE, FILESYSTEM_ACTION, SIZE_MODE } from "./fields";
import type { ConfigModel } from "~/model/storage/config-model";
import type { FilesystemFields, SizeFields } from "./fields";

/**
 * Fields read when building a filesystem configuration.
 *
 * The filesystemAction field is excluded: by the time these helpers run, a
 * reuse decision is already encoded in the filesystem field itself, which can
 * hold FILESYSTEM_ACTION.REUSE in addition to FILESYSTEM_TYPE.AUTO and
 * concrete filesystem types.
 */
type FilesystemConfigFields = Omit<FilesystemFields, "filesystemAction">;

/**
 * Builds a filesystem configuration from form values.
 *
 * Handles three cases:
 * 1. **REUSE**: Keep existing filesystem, only allow mount options
 * 2. **AUTO**: Let installer choose filesystem type, allow all options
 * 3. **Explicit type**: User-selected filesystem type, allow all options
 *
 * Optional filesystem settings (label, mkfsExtraArguments, mountOptions) are
 * only included when the showMoreFilesystemSettings checkbox is checked AND
 * the field is non-empty.
 *
 * @param values - Form field values containing filesystem configuration
 * @returns Filesystem config for ConfigModel, or undefined for "no filesystem"
 *
 * @example
 * // REUSE existing filesystem
 * buildFilesystemConfig({
 *   filesystem: "reuse",
 *   mountOptions: [/"noatime"/],
 *   showMoreFilesystemSettings: true,
 *   ...
 * })
 * // → { reuse: true, default: true, mountOptions: ["noatime"] }
 *
 * @example
 * // AUTO selection with label
 * buildFilesystemConfig({
 *   filesystem: "auto",
 *   filesystemLabel: "my-data",
 *   showMoreFilesystemSettings: true,
 *   ...
 * })
 * // → { default: true, label: "my-data" }
 *
 * @example
 * // Explicit XFS with mkfs options
 * buildFilesystemConfig({
 *   filesystem: "xfs",
 *   mkfsExtraArguments: "-m crc=1",
 *   showMoreFilesystemSettings: true,
 *   ...
 * })
 * // → { default: false, type: "xfs", mkfsExtraArguments: "-m crc=1" }
 */
export function buildFilesystemConfig(
  values: FilesystemConfigFields,
): ConfigModel.Filesystem | undefined {
  // Helper: only include optional settings when checkbox is checked and value is non-empty
  const extraSetting = <K extends keyof FilesystemConfigFields>(
    attr: K,
  ): FilesystemConfigFields[K] | undefined => {
    if (!values.showMoreFilesystemSettings) return undefined;
    if (isEmpty(values[attr])) return undefined;
    return values[attr];
  };

  // Case 1: Reuse existing filesystem
  if (values.filesystem === FILESYSTEM_ACTION.REUSE) {
    return {
      reuse: true,
      default: true,
      mountOptions: (extraSetting("mountOptions") as string[]) || undefined,
    };
  }

  // Case 2: Automatic filesystem selection
  if (values.filesystem === FILESYSTEM_TYPE.AUTO) {
    return {
      default: true,
      label: (extraSetting("filesystemLabel") as string) || undefined,
      mkfsExtraArguments: (extraSetting("mkfsExtraArguments") as string) || undefined,
      mountOptions: (extraSetting("mountOptions") as string[]) || undefined,
    };
  }

  // Case 3: Explicit filesystem type
  return {
    default: false,
    type: values.filesystem as ConfigModel.FilesystemType,
    label: (extraSetting("filesystemLabel") as string) || undefined,
    mkfsExtraArguments: (extraSetting("mkfsExtraArguments") as string) || undefined,
    mountOptions: (extraSetting("mountOptions") as string[]) || undefined,
  };
}

/**
 * Builds a size configuration from form values.
 *
 * Handles four size modes:
 * - **AUTO**: Omit size config, let installer decide
 * - **FIXED**: Set min = max to force exact size
 * - **RANGE**: Set min and optional max for flexible sizing
 * - **EXPAND**: Set min only, max is unbounded
 *
 * Returns undefined when:
 * - Mode is AUTO (automatic sizing)
 * - Required field for the mode is empty (e.g., fixedSize for FIXED mode)
 *
 * @param values - Form field values containing size configuration
 * @returns Size config for ConfigModel, or undefined for automatic sizing
 *
 * @example
 * // Fixed 10 GiB
 * buildSizeConfig({ sizeMode: "fixed", fixedSize: "10 GiB", ... })
 * // → { default: false, min: 10737418240, max: 10737418240 }
 *
 * @example
 * // Range: 5-20 GiB
 * buildSizeConfig({
 *   sizeMode: "range",
 *   rangeMinSize: "5 GiB",
 *   rangeMaxSize: "20 GiB",
 *   ...
 * })
 * // → { default: false, min: 5368709120, max: 21474836480 }
 *
 * @example
 * // Expand from 8 GiB (no max)
 * buildSizeConfig({ sizeMode: "expand", expandMinSize: "8 GiB", ... })
 * // → { default: false, min: 8589934592, max: undefined }
 *
 * @example
 * // Automatic sizing
 * buildSizeConfig({ sizeMode: "auto", ... })
 * // → undefined
 */
export function buildSizeConfig(values: SizeFields): ConfigModel.Size | undefined {
  if (values.sizeMode === SIZE_MODE.AUTO) return undefined;

  if (values.sizeMode === SIZE_MODE.FIXED) {
    return values.fixedSize
      ? {
          default: false,
          min: parseToBytes(values.fixedSize),
          max: parseToBytes(values.fixedSize),
        }
      : undefined;
  }

  if (values.sizeMode === SIZE_MODE.RANGE) {
    return values.rangeMinSize
      ? {
          default: false,
          min: parseToBytes(values.rangeMinSize),
          max: values.rangeMaxSize ? parseToBytes(values.rangeMaxSize) : undefined,
        }
      : undefined;
  }

  if (values.sizeMode === SIZE_MODE.EXPAND) {
    return values.expandMinSize
      ? { default: false, min: parseToBytes(values.expandMinSize) }
      : undefined;
  }

  return undefined;
}

/**
 * Config type that has a size property with the standard structure.
 *
 * Covers both ConfigModel.Partition and ConfigModel.LogicalVolume.
 */
type ConfigWithSize = {
  name?: string;
  size?: ConfigModel.Size;
};

/**
 * Infers size form fields from a stored device configuration.
 *
 * This is the reverse operation of buildSizeConfig: it converts a stored size
 * configuration back into the form field values that would produce it.
 *
 * Returns AUTO mode (all fields empty) when:
 * - Config is for reusing an existing device (name is set)
 * - Size config is missing, default, or has no min value
 *
 * Otherwise, reconstructs the size mode from min/max values:
 * - **min only**: EXPAND mode
 * - **min === max**: FIXED mode
 * - **min < max**: RANGE mode
 *
 * @param config - Partition or LogicalVolume configuration
 * @returns Size field values matching the stored configuration
 *
 * @example
 * // Fixed size: 10 GiB
 * inferSizeFields({
 *   size: { default: false, min: 10737418240, max: 10737418240 }
 * })
 * // → { sizeMode: "fixed", fixedSize: "10 GiB", ... }
 *
 * @example
 * // Range: 5-20 GiB
 * inferSizeFields({
 *   size: { default: false, min: 5368709120, max: 21474836480 }
 * })
 * // → { sizeMode: "range", rangeMinSize: "5 GiB", rangeMaxSize: "20 GiB", ... }
 *
 * @example
 * // Reusing existing partition
 * inferSizeFields({ name: "/dev/sda1", size: { ... } })
 * // → { sizeMode: "auto", fixedSize: "", ... } (always AUTO for reuse)
 */
export function inferSizeFields(config: ConfigWithSize): SizeFields {
  const defaults: SizeFields = {
    sizeMode: SIZE_MODE.AUTO,
    fixedSize: "",
    rangeMinSize: "",
    rangeMaxSize: "",
    expandMinSize: "",
  };

  // Reusing an existing device always shows AUTO mode
  const isReuse = config.name !== undefined;
  if (isReuse) return defaults;

  const sizeConfig = config.size;
  if (!sizeConfig || sizeConfig.default || sizeConfig.min === undefined) return defaults;

  const minSizeValue = deviceSize(sizeConfig.min, { exact: true });

  // No max: EXPAND mode
  if (sizeConfig.max === undefined) {
    return { ...defaults, sizeMode: SIZE_MODE.EXPAND, expandMinSize: minSizeValue };
  }

  const maxSizeValue = deviceSize(sizeConfig.max, { exact: true });

  // min === max: FIXED mode
  if (sizeConfig.min === sizeConfig.max) {
    return { ...defaults, sizeMode: SIZE_MODE.FIXED, fixedSize: minSizeValue };
  }

  // min < max: RANGE mode
  return {
    ...defaults,
    sizeMode: SIZE_MODE.RANGE,
    rangeMinSize: minSizeValue,
    rangeMaxSize: maxSizeValue,
  };
}

/**
 * Maps a stored filesystem configuration to the form's filesystem field value.
 *
 * Used when initializing form values from an existing configuration:
 * - **default: true**: Maps to AUTO sentinel
 * - **explicit type**: Maps to the type string (e.g., "xfs", "btrfs")
 * - **undefined/missing**: Falls back to AUTO
 *
 * @param fsConfig - Filesystem configuration from ConfigModel
 * @returns String value for the form's filesystem field
 *
 * @example
 * fsConfigValue({ default: true, type: "btrfs" })
 * // → "auto"
 *
 * @example
 * fsConfigValue({ default: false, type: "xfs" })
 * // → "xfs"
 *
 * @example
 * fsConfigValue(undefined)
 * // → "auto"
 */
export function fsConfigValue(fsConfig: ConfigModel.Filesystem | undefined): string {
  if (fsConfig?.default) return FILESYSTEM_TYPE.AUTO;
  return fsConfig?.type || FILESYSTEM_TYPE.AUTO;
}
