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
 * Transformation functions for the formattable device form.
 *
 * This module handles conversion between the device ConfigModel types and form
 * field values. It provides:
 *
 * - **buildPayload**: Converts form values to Data.Formattable for API mutations
 * - **toFormValues**: Converts the stored device config to initial form values
 *
 * ## Data Flow
 *
 * ```
 * Initial load:
 *   Partitionable.Device → toFormValues() → FormValues → TanStack Form state
 *
 * Form submission:
 *   TanStack Form state → FormValues → buildPayload() → Data.Formattable → API
 * ```
 *
 * ## Shared Helpers
 *
 * This module uses generic transformation helpers from shared/transformations.ts
 * for the filesystem configuration. Unlike the partition and logical volume
 * forms there is no size configuration and no device name field: the whole
 * device is always used.
 *
 * @see shared/transformations.ts
 */

import {
  buildFilesystemConfig,
  fsConfigValue,
  FILESYSTEM_ACTION,
} from "~/components/storage/shared/transformations";
import { defaultOptions } from "./fields";
import type { Data, Partitionable } from "~/model/storage/config-model";

/**
 * Builds a formattable device configuration from validated form values.
 *
 * Converts the form's field values into a Data.Formattable structure suitable
 * for the setFilesystem API mutation.
 *
 * ## Field Mapping
 *
 * - **mountPath**: Directly from mountPoint field
 * - **filesystem**: Built using shared helper, handles REUSE/AUTO/explicit type
 *
 * ## Omitted Fields
 *
 * - Filesystem extra settings only included when showMoreFilesystemSettings is
 *   checked
 *
 * @param values - Validated form field values
 * @returns Formattable device configuration ready for API mutation
 *
 * @example
 * // Format the device with an explicit filesystem
 * buildPayload({
 *   mountPoint: "/home",
 *   filesystem: "xfs",
 *   ...
 * })
 * // → {
 * //     mountPath: "/home",
 * //     filesystem: { default: false, type: "xfs" },
 * //   }
 *
 * @example
 * // Keep the current filesystem
 * buildPayload({
 *   mountPoint: "/var",
 *   filesystem: "reuse",
 *   ...
 * })
 * // → {
 * //     mountPath: "/var",
 * //     filesystem: { reuse: true, default: true },
 * //   }
 */
export function buildPayload(values: typeof defaultOptions.defaultValues): Data.Formattable {
  return {
    mountPath: values.mountPoint,
    filesystem: buildFilesystemConfig(values),
  };
}

/**
 * Maps the stored device configuration to initial form values.
 *
 * Converts a drive or MD RAID config (from the backend) into the field values
 * needed to initialize the form. This is the inverse of buildPayload.
 *
 * ## Filesystem Action Detection
 *
 * Defaults to REUSE (keep existing filesystem) only when the stored config
 * explicitly says so (reuse: true). Unlike the partition and logical volume
 * forms there is no "new device" case: the device always exists, so reuse is
 * driven by the stored filesystem config alone.
 *
 * ## Extra Filesystem Settings
 *
 * The showMoreFilesystemSettings checkbox is pre-checked when any of label,
 * mkfsOptions, or mountOptions are non-empty in the stored config.
 *
 * @param deviceModel - Drive or MD RAID config from the backend
 * @returns Partial form values to merge with defaults
 *
 * @example
 * // Device already configured with a filesystem
 * toFormValues({
 *   name: "/dev/sda",
 *   mountPath: "/home",
 *   filesystem: { default: false, type: "xfs", label: "home-data" },
 * })
 * // → {
 * //     mountPoint: "/home",
 * //     committedMountPoint: "/home",
 * //     filesystem: "xfs",
 * //     filesystemAction: "format",
 * //     filesystemLabel: "home-data",
 * //     showMoreFilesystemSettings: true,  // has label
 * //     ...
 * //   }
 *
 * @example
 * // Device not configured yet
 * toFormValues({ name: "/dev/sda", spacePolicy: "keep", partitions: [] })
 * // → { mountPoint: "", filesystem: "auto", ... }  (form defaults)
 */
export function toFormValues(
  deviceModel: Partitionable.Device,
): Partial<typeof defaultOptions.defaultValues> {
  const fsConfig = deviceModel.filesystem;

  // Keeping the current filesystem unless the config explicitly says to format
  // (reuse: false).
  const shouldKeepFilesystem = fsConfig !== undefined && fsConfig.reuse === true;

  const mountPoint = deviceModel.mountPath || "";
  const filesystemLabel = fsConfig?.label || "";
  const mkfsOptions = fsConfig?.mkfsOptions || [];
  const mountOptions = fsConfig?.mountOptions || [];
  const showMoreFilesystemSettings =
    filesystemLabel !== "" || !!mkfsOptions.length || !!mountOptions.length;

  return {
    mountPoint,
    committedMountPoint: mountPoint,
    filesystem: shouldKeepFilesystem ? FILESYSTEM_ACTION.REUSE : fsConfigValue(fsConfig),
    filesystemAction: shouldKeepFilesystem ? FILESYSTEM_ACTION.REUSE : FILESYSTEM_ACTION.FORMAT,
    filesystemLabel,
    mkfsOptions,
    mountOptions,
    showMoreFilesystemSettings,
  };
}
