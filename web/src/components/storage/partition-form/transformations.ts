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
 * Transformation functions for the partition form.
 *
 * This module handles conversion between partition ConfigModel types and form
 * field values. It provides:
 *
 * - **buildPayload**: Converts form values to ConfigModel.Partition for API mutations
 * - **toFormValues**: Converts ConfigModel.Partition to initial form values
 * - **useSolvedSizes**: Calculates min/max sizes by querying the backend solver
 *
 * ## Data Flow
 *
 * ```
 * Initial load:
 *   ConfigModel.Partition → toFormValues() → FormValues → TanStack Form state
 *
 * Form submission:
 *   TanStack Form state → FormValues → buildPayload() → ConfigModel.Partition → API
 *
 * Size hints (during editing):
 *   FormValues (mount point, filesystem) → useSolvedSizes() → { min, max } → UI
 * ```
 *
 * ## Shared Helpers
 *
 * This module uses generic transformation helpers from shared/transformations.ts
 * for filesystem and size configuration. Form-specific logic handles the
 * partition name field (for reusing existing partitions).
 *
 * @see shared/transformations.ts
 */

import { useParams } from "react-router";
import {
  useConfigModel,
  usePartitionable,
  useSolvedConfigModel,
} from "~/hooks/model/storage/config-model";
import configModel from "~/model/storage/config-model";
import {
  createPartitionableLocation,
  findPartitionableDevice,
  deviceSize,
} from "~/components/storage/utils";
import {
  buildFilesystemConfig,
  buildSizeConfig,
  inferSizeFields,
  fsConfigValue,
} from "~/components/storage/shared/transformations";
import { FILESYSTEM_TYPE, FILESYSTEM_ACTION, isReusingPartition, defaultOptions } from "./fields";
import type { SolvedSizes } from "~/components/storage/shared/SizeFields";
import type { ConfigModel } from "~/model/storage/config-model";

/**
 * Builds a partition configuration from validated form values.
 *
 * Converts the form's field values into a ConfigModel.Partition structure
 * suitable for API mutations (add/edit partition).
 *
 * ## Field Mapping
 *
 * - **mountPath**: Directly from mountPoint field
 * - **name**: Set only when reusing an existing partition
 * - **filesystem**: Built using shared helper, handles REUSE/AUTO/explicit type
 * - **size**: Built using shared helper, handles AUTO/FIXED/RANGE/EXPAND modes
 *
 * ## Omitted Fields
 *
 * - Filesystem config is omitted when form values indicate "no filesystem"
 * - Size config is omitted when mode is AUTO (automatic sizing)
 * - Filesystem extra settings only included when showMoreFilesystemSettings is checked
 *
 * @param values - Validated form field values
 * @returns Partition configuration ready for API mutation
 *
 * @example
 * // Create new partition with explicit filesystem
 * buildPayload({
 *   mountPoint: "/home",
 *   name: "",  // empty = new partition
 *   filesystem: "xfs",
 *   sizeMode: "fixed",
 *   fixedSize: "20 GiB",
 *   ...
 * })
 * // → {
 * //     mountPath: "/home",
 * //     name: undefined,
 * //     filesystem: { default: false, type: "xfs" },
 * //     size: { default: false, min: 21474836480, max: 21474836480 }
 * //   }
 *
 * @example
 * // Reuse existing partition
 * buildPayload({
 *   mountPoint: "/var",
 *   name: "/dev/sda2",  // non-empty = reuse
 *   filesystem: "reuse",
 *   ...
 * })
 * // → {
 * //     mountPath: "/var",
 * //     name: "/dev/sda2",
 * //     filesystem: { reuse: true, default: true },
 * //     size: undefined  // size not used when reusing
 * //   }
 */
export function buildPayload(values: typeof defaultOptions.defaultValues): ConfigModel.Partition {
  const isReuse = isReusingPartition(values.name);

  return {
    mountPath: values.mountPoint,
    name: isReuse ? values.name : undefined,
    filesystem: buildFilesystemConfig(values),
    size: buildSizeConfig(values),
  };
}

/**
 * Maps a stored partition configuration to initial form values.
 *
 * Converts a ConfigModel.Partition (from the backend) into the field values
 * needed to initialize the form. This is the inverse of buildPayload.
 *
 * Returns an empty object when creating a new partition (config is null),
 * which allows form defaults to take precedence.
 *
 * ## Filesystem Action Detection
 *
 * When editing an existing partition with a filesystem, defaults to REUSE
 * (keep existing filesystem) unless the config explicitly says reuse: false.
 *
 * ## Size Field Inference
 *
 * Uses the shared inferSizeFields helper to reconstruct size mode and values
 * from the stored min/max bytes. Reused partitions always show AUTO mode.
 *
 * ## Extra Filesystem Settings
 *
 * The showMoreFilesystemSettings checkbox is pre-checked when any of label,
 * mkfsExtraArguments, or mountOptions are non-empty in the stored config.
 *
 * @param partitionConfig - Partition config from backend, or null for new partition
 * @returns Partial form values to merge with defaults
 *
 * @example
 * // Editing existing partition with filesystem
 * toFormValues({
 *   mountPath: "/home",
 *   name: "/dev/sda3",
 *   filesystem: { type: "xfs", label: "home-data" },
 *   size: { default: false, min: 10737418240, max: 10737418240 }
 * })
 * // → {
 * //     mountPoint: "/home",
 * //     committedMountPoint: "/home",
 * //     name: "/dev/sda3",
 * //     filesystem: "reuse",  // default to keeping existing
 * //     filesystemAction: "reuse",
 * //     filesystemLabel: "home-data",
 * //     showMoreFilesystemSettings: true,  // has label
 * //     sizeMode: "auto",  // reuse always shows AUTO
 * //     ...
 * //   }
 *
 * @example
 * // Creating new partition
 * toFormValues(null)
 * // → {}  (form defaults take precedence)
 */
export function toFormValues(
  partitionConfig: ConfigModel.Partition | null,
): Partial<typeof defaultOptions.defaultValues> {
  if (!partitionConfig) return {};

  const fsConfig = partitionConfig.filesystem;
  const isReusePartition = partitionConfig.name !== undefined;

  // When editing a reused partition, default to keeping the filesystem when
  // the config explicitly says so (reuse: true, the stored form of the
  // "Current" choice, which carries no type) or when it has a type and does
  // not explicitly ask for formatting (reuse: false)
  const keepsByConfig = fsConfig?.reuse === true;
  const keepsByType = fsConfig?.type !== undefined && fsConfig?.reuse !== false;
  const shouldKeepFilesystem = isReusePartition && (keepsByConfig || keepsByType);

  const mountPoint = partitionConfig.mountPath || "";
  const filesystemLabel = fsConfig?.label || "";
  const mkfsExtraArguments = fsConfig?.mkfsExtraArguments || "";
  const mountOptions = fsConfig?.mountOptions || [];
  const showMoreFilesystemSettings =
    filesystemLabel !== "" || mkfsExtraArguments !== "" || !!mountOptions.length;

  return {
    mountPoint,
    committedMountPoint: mountPoint,
    name: partitionConfig.name || "",
    filesystem: shouldKeepFilesystem ? FILESYSTEM_ACTION.REUSE : fsConfigValue(fsConfig),
    filesystemAction: shouldKeepFilesystem ? FILESYSTEM_ACTION.REUSE : FILESYSTEM_ACTION.FORMAT,
    filesystemLabel,
    mkfsExtraArguments,
    mountOptions,
    showMoreFilesystemSettings,
    ...inferSizeFields(partitionConfig),
  };
}

/**
 * Builds a sparse partition config for size calculation.
 *
 * Creates a minimal partition configuration with:
 * - The current mount point
 * - The selected filesystem (or undefined when AUTO, letting solver choose)
 * - Size omitted (forces automatic calculation)
 * - Always treated as a new partition (name: undefined)
 *
 * This sparse config is sent to the backend solver to calculate min/max sizes
 * based on the volume template and available space.
 *
 * @param mountPoint - Current mount point field value
 * @param filesystem - Current filesystem field value (including AUTO)
 * @returns Complete ConfigModel with the sparse partition, or undefined if
 *   mount point is empty
 */
function useSparseModel(mountPoint: string, filesystem: string): ConfigModel.Config | undefined {
  const { collection, index } = useParams();
  const model = useConfigModel();
  const location = createPartitionableLocation(collection, index);
  const device = usePartitionable(
    location?.collection || "drives",
    location?.index !== undefined ? location.index : 0,
  );

  if (!location || !model) return undefined;

  // Sizes are only solved for new partitions with a mount point
  if (mountPoint === "" || filesystem === "") {
    return undefined;
  }

  const partitionConfig: ConfigModel.Partition = {
    mountPath: mountPoint,
    name: undefined, // Always treat as new partition for size calculation
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

  const initialPartitionCfg = device
    ? configModel.partitionable.findPartition(device, mountPoint)
    : null;
  const idx = location.index;

  return initialPartitionCfg
    ? configModel.partition.edit(model, location.collection, idx, mountPoint, partitionConfig)
    : configModel.partition.add(model, location.collection, idx, partitionConfig);
}

/**
 * Calculates solved sizes for a partition configuration.
 *
 * This hook is passed to the shared SizeFields component, which calls it
 * whenever the committed mount point or filesystem changes. The backend solver
 * determines min/max sizes based on:
 *
 * - Volume template for the mount point (if any)
 * - Available space on the partitionable device
 * - Filesystem overhead
 *
 * ## When Sizes Are Calculated
 *
 * For new partitions with a mount point. Works with both AUTO and explicit
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
 * // New /home partition with XFS
 * useSolvedSizes("/home", "xfs")
 * // → { min: "5 GiB", max: "100 GiB" }
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
  const { collection, index } = useParams();

  const sparseModel = useSparseModel(mountPoint, filesystem);
  const solvedModel = useSolvedConfigModel(sparseModel);

  if (!solvedModel || !collection || !index) return null;

  const solvedDevice = findPartitionableDevice(solvedModel, collection, index);
  const solvedPartition = solvedDevice?.partitions?.find((p) => p.mountPath === mountPoint);

  if (!solvedPartition?.size) return null;

  return {
    min: solvedPartition.size.min ? deviceSize(solvedPartition.size.min) : undefined,
    max: solvedPartition.size.max ? deviceSize(solvedPartition.size.max) : undefined,
  };
}
