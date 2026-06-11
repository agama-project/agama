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

import { buildFilesystemConfig, fsConfigValue } from "~/components/storage/shared/transformations";
import { defaultOptions, FILESYSTEM_ACTION } from "./fields";
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
 * The stored filesystem config decides the filesystemAction:
 *
 * - `{ reuse: true }`: the user chose "Current", so REUSE.
 * - Any other config: the user chose to format, so FORMAT.
 * - No config at all: the device is not configured yet, so the action stays
 *   REUSE. This does NOT mean keeping the filesystem: it just records that
 *   formatting is not a deliberate choice, so the filesystem fields can
 *   preselect "Current" when the device has a filesystem compatible with the
 *   mount point. For a device without a filesystem the action is irrelevant,
 *   since "Current" is never offered.
 *
 * This mirrors the partition and logical volume forms, where picking an
 * existing device with a filesystem preselects "Current".
 *
 * ## Extra Filesystem Settings
 *
 * The showMoreFilesystemSettings checkbox is pre-checked when any of label,
 * mkfsExtraArguments, or mountOptions are non-empty in the stored config.
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
 * // → { mountPoint: "", filesystem: "auto", filesystemAction: "reuse", ... }
 */
export function toFormValues(
  deviceModel: Partitionable.Device,
): Partial<typeof defaultOptions.defaultValues> {
  const fsConfig = deviceModel.filesystem;

  // The stored shape of the "Current" choice.
  const keepsFilesystem = fsConfig?.reuse === true;
  // Any other stored config means a deliberate choice to format. See the
  // "Filesystem Action Detection" section above for the no-config case.
  const formatsFilesystem = fsConfig !== undefined && !keepsFilesystem;

  const mountPoint = deviceModel.mountPath || "";
  const filesystemLabel = fsConfig?.label || "";
  const mkfsExtraArguments = fsConfig?.mkfsExtraArguments || "";
  const mountOptions = fsConfig?.mountOptions || [];
  const showMoreFilesystemSettings =
    filesystemLabel !== "" || mkfsExtraArguments !== "" || !!mountOptions.length;

  return {
    mountPoint,
    committedMountPoint: mountPoint,
    filesystem: keepsFilesystem ? FILESYSTEM_ACTION.REUSE : fsConfigValue(fsConfig),
    filesystemAction: formatsFilesystem ? FILESYSTEM_ACTION.FORMAT : FILESYSTEM_ACTION.REUSE,
    filesystemLabel,
    mkfsExtraArguments,
    mountOptions,
    showMoreFilesystemSettings,
  };
}
