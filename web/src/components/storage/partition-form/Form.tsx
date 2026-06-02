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

import React from "react";
import { useParams, useNavigate } from "react-router";
import { ActionGroup, Form } from "@patternfly/react-core";
import Page from "~/components/core/Page";
import ResourceNotFound from "~/components/core/ResourceNotFound";
import NestedContent from "~/components/core/NestedContent";
import { deviceSize, createPartitionableLocation, parseToBytes } from "~/components/storage/utils";
import { withFrozenQuery } from "~/components/form/with-frozen-query";
import { useAppForm, mergeFormDefaults } from "~/hooks/form";
import { useDevice } from "~/hooks/model/system/storage";
import {
  useConfigModel,
  useMissingMountPaths,
  usePartitionable,
  useAddPartition,
  useEditPartition,
} from "~/hooks/model/storage/config-model";
import configModel from "~/model/storage/config-model";
import { STORAGE } from "~/routes/paths";
import { compact } from "~/utils";
import { _ } from "~/i18n";

import PartitionFields from "./PartitionFields";
import FilesystemFields from "./FilesystemFields";
import FilesystemAdditionalFields from "./FilesystemAdditionalFields";
import SizeFields from "./SizeFields";
import {
  defaultOptions,
  validate,
  isReusingPartition,
  supportsAdditionalConfig,
  FILESYSTEM_TYPE,
  FILESYSTEM_ACTION,
  SIZE_MODE,
  SizeMode,
} from "./fields";

import type { ConfigModel as ConfigModelType, Partitionable } from "~/model/storage/config-model";
import type { Storage as System } from "~/model/system";
import type { BreadcrumbProps } from "~/components/core/Breadcrumbs";

/**
 * Resolves the partitionable device model from the current route params.
 *
 * Calls `usePartitionable` unconditionally (hook rules) with safe fallback
 * values when the location cannot be parsed, then returns `null` if the route
 * params do not map to a valid partitionable location.
 */
function useDeviceModelFromParams(): Partitionable.Device | null {
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
 * Returns the existing {@link ConfigModelType.Partition} being edited, or
 * `null` when creating a new partition.
 *
 * The `partitionId` route param holds the mount path used to look up the
 * partition within the device resolved by {@link useDeviceModelFromParams}.
 */
function useInitialPartitionConfig(): ConfigModelType.Partition | null {
  const { partitionId: mountPath } = useParams();
  const device = useDeviceModelFromParams();
  return mountPath && device ? configModel.partitionable.findPartition(device, mountPath) : null;
}

/** Unused predefined mount points. Includes the currently used mount point when editing. */
function useUnusedMountPoints(): string[] {
  const unusedMountPaths = useMissingMountPaths();
  const initialPartitionConfig = useInitialPartitionConfig();
  return compact([initialPartitionConfig?.mountPath, ...unusedMountPaths]);
}

/** Unused partitions. Includes the currently used partition when editing (if any). */
function useUnusedPartitions(): System.Device[] {
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

/**
 * Builds a {@link ConfigModelType.Partition} from the validated form values.
 *
 * Size fields are omitted when reusing an existing partition; filesystem and
 * size are each omitted when their respective form mode selects automatic or
 * default behaviour.
 */
function buildPayload(values: typeof defaultOptions.defaultValues): ConfigModelType.Partition {
  const isReuse = isReusingPartition(values.name);

  // Filesystem configuration
  const filesystem = (): ConfigModelType.Filesystem | undefined => {
    // Reuse existing filesystem (filesystem field holds REUSE sentinel)
    if (values.filesystem === FILESYSTEM_ACTION.REUSE) {
      return { reuse: true, default: true };
    }

    // Automatic filesystem selection
    if (values.filesystem === FILESYSTEM_TYPE.AUTO) {
      return undefined;
    }

    // Explicit filesystem type
    return {
      default: false,
      type: values.filesystem as ConfigModelType.FilesystemType,
      label: values.filesystemLabel || undefined,
    };
  };

  // Size configuration
  const size = (): ConfigModelType.Size | undefined => {
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
        ? {
            default: false,
            min: parseToBytes(values.expandMinSize),
          }
        : undefined;
    }

    return undefined;
  };

  return {
    mountPath: values.mountPoint,
    name: isReuse ? values.name : undefined,
    filesystem: filesystem(),
    size: size(),
  };
}

/**
 * Infers size form fields from a stored {@link ConfigModelType.Partition}.
 *
 * Uses early returns to avoid nesting: each guard exits with defaults when
 * the size cannot be determined, leaving the happy paths flat.
 */
function inferSizeFields(partitionConfig: ConfigModelType.Partition): {
  sizeMode: SizeMode;
  fixedSize: string;
  rangeMinSize: string;
  rangeMaxSize: string;
  expandMinSize: string;
} {
  const defaults = {
    sizeMode: SIZE_MODE.AUTO,
    fixedSize: "",
    rangeMinSize: "",
    rangeMaxSize: "",
    expandMinSize: "",
  } as const;

  const isReuse = partitionConfig.name !== undefined;
  if (isReuse) return defaults;

  const sizeConfig = partitionConfig.size;
  if (!sizeConfig || sizeConfig.default || sizeConfig.min === undefined) return defaults;

  const minSizeValue = deviceSize(sizeConfig.min, { exact: true });

  if (sizeConfig.max === undefined) {
    return { ...defaults, sizeMode: SIZE_MODE.EXPAND, expandMinSize: minSizeValue };
  }

  const maxSizeValue = deviceSize(sizeConfig.max, { exact: true });

  if (sizeConfig.min === sizeConfig.max) {
    return { ...defaults, sizeMode: SIZE_MODE.FIXED, fixedSize: minSizeValue };
  }

  return {
    ...defaults,
    sizeMode: SIZE_MODE.RANGE,
    rangeMinSize: minSizeValue,
    rangeMaxSize: maxSizeValue,
  };
}

/**
 * Maps a stored {@link ConfigModelType.Partition} to initial form values for
 * editing, or returns an empty object when creating a new partition.
 *
 * Reconstructs the size mode (auto / fixed / range / expand) from the stored
 * min/max byte values, and infers the filesystem action from the `reuse` flag.
 */
function toFormValues(
  partitionConfig: ConfigModelType.Partition | null,
): Partial<typeof defaultOptions.defaultValues> {
  if (!partitionConfig) return {};

  const fsConfig = partitionConfig.filesystem;
  const isReusePartition = partitionConfig.name !== undefined;

  // When editing an existing partition with a filesystem, default to keeping it (REUSE)
  // unless the config explicitly says to format (reuse: false)
  const shouldKeepFilesystem =
    isReusePartition && fsConfig?.type !== undefined && fsConfig.reuse !== false;

  const mountPoint = partitionConfig.mountPath || "";
  const filesystemLabel = fsConfig?.label || "";
  return {
    mountPoint,
    committedMountPoint: mountPoint,
    name: partitionConfig.name || "",
    // Default to REUSE when editing partition with filesystem; otherwise use actual type or AUTO
    filesystem: shouldKeepFilesystem
      ? FILESYSTEM_ACTION.REUSE
      : fsConfig?.type || FILESYSTEM_TYPE.AUTO,
    filesystemAction: shouldKeepFilesystem ? FILESYSTEM_ACTION.REUSE : FILESYSTEM_ACTION.FORMAT,
    filesystemLabel,
    showMoreFilesystemSettings: filesystemLabel !== "",
    ...inferSizeFields(partitionConfig),
  };
}

/**
 * Query data frozen on mount to protect the form from mid-interaction
 * refetches. Does not include deviceModel or systemDevice — those are owned
 * by PartitionForm, which uses them for the Page shield and null-check before
 * rendering this component at all.
 *
 * @see withFrozenQuery
 */
type PartitionFormContentQuery = {
  // Guaranteed non-null by PartitionForm's pre-render guard.
  systemDevice: System.Device | undefined;
  availablePartitions: System.Device[];
  initialPartition: ConfigModelType.Partition | null;
  unusedMountPoints: string[];
  config: ReturnType<typeof useConfigModel>;
};

/**
 * Aggregates the query hooks whose data feeds the form's defaultValues and
 * field options. Called at the wrapper level by withFrozenQuery.
 */
function usePartitionFormContentQuery(): PartitionFormContentQuery {
  const deviceModel = useDeviceModelFromParams();
  return {
    systemDevice: useDevice(deviceModel?.name),
    availablePartitions: useUnusedPartitions(),
    initialPartition: useInitialPartitionConfig(),
    unusedMountPoints: useUnusedMountPoints(),
    config: useConfigModel(),
  };
}

/**
 * Inner form for creating or editing a partition.
 *
 * Receives frozen query data as props via withFrozenQuery. Mutation hooks
 * (useAddPartition, useEditPartition) and navigation are called internally
 * and are intentionally not frozen — they must always be fresh.
 *
 * Allows configuring:
 * - Mount point (with suggestions)
 * - Partition source (new vs use existing)
 * - Filesystem type and label
 * - Size settings (only for new partitions)
 */
function PartitionFormContent({
  systemDevice,
  availablePartitions,
  initialPartition,
  unusedMountPoints,
  config,
}: PartitionFormContentQuery) {
  // Route params and mutations are not frozen: they don't feed defaultValues
  // and must always reflect the current state.
  const { collection, index } = useParams();
  const navigate = useNavigate();
  const addPartition = useAddPartition();
  const editPartition = useEditPartition();

  // Get used mount points for validation (excluding current when editing).
  const usedMountPoints = React.useMemo(() => {
    if (!config) return [];
    const allUsed = configModel.usedMountPaths(config);
    const currentMountPoint = initialPartition?.mountPath;
    return allUsed.filter((mp) => mp !== currentMountPoint);
  }, [config, initialPartition]);

  const form = useAppForm({
    ...mergeFormDefaults(defaultOptions, toFormValues(initialPartition)),
    validators: {
      onSubmitAsync: async ({ value }) => validate(value, usedMountPoints),
    },
    onSubmit: async ({ value }) => {
      const payload = buildPayload(value);
      const partitionableLocation = createPartitionableLocation(collection, index);
      if (!partitionableLocation) return;

      if (initialPartition) {
        editPartition(
          partitionableLocation.collection,
          partitionableLocation.index,
          initialPartition.mountPath,
          payload,
        );
      } else {
        addPartition(partitionableLocation.collection, partitionableLocation.index, payload);
      }

      navigate(-1);
    },
  });

  // Unreachable: PartitionForm only renders this component when systemDevice
  // is defined. The guard keeps TypeScript satisfied without a cast.
  if (!systemDevice) return null;

  return (
    <form.AppForm>
      <Form
        onSubmit={(e) => {
          e.preventDefault();
          form.setErrorMap({ onSubmit: { fields: {} } });
          form.handleSubmit();
        }}
      >
        {/* Mount point
         *
         * Uses a "committed value" pattern to avoid reacting to incomplete input.
         * The `committedMountPoint` field tracks a stable value that only updates when:
         * - The form mounts (onMount)
         * - User selects a suggestion (onSelect callback)
         * - User finishes typing (onBlur)
         *
         * Why: Prevents showing misleading filesystem options and size hints while
         * user types "/ho..." before completing "/home". Also avoids expensive
         * recalculations (useVolumeTemplate) on every keystroke.
         *
         * FilesystemFields and SizeFields use `committedMountPoint` instead of live
         * `mountPoint` for all derived calculations.
         */}
        <form.AppField
          name="mountPoint"
          listeners={{
            // Initialize committedMountPoint when form loads (for editing existing partitions).
            onMount: ({ value }) => {
              form.setFieldValue("committedMountPoint", value, { dontUpdateMeta: true });
            },
            // Update committedMountPoint when user finishes typing.
            // Deferred to avoid showing incomplete/misleading information while typing.
            onBlur: ({ value }) => {
              form.setFieldValue("committedMountPoint", value, { dontUpdateMeta: true });
            },
          }}
        >
          {(field) => (
            <field.SuggestionsTextField
              label={_("Mount point")}
              suggestions={unusedMountPoints}
              helperText={_("e.g., /, /home, /var, swap")}
              onSelect={(value) => {
                // Update committedMountPoint immediately when user selects a suggestion
                // (click or Enter key). Safe to show filesystem options and size hints
                // immediately since the value is complete and intentional.
                form.setFieldValue("committedMountPoint", value, { dontUpdateMeta: true });
              }}
            />
          )}
        </form.AppField>

        {/* Partition */}
        <PartitionFields
          form={form}
          device={systemDevice}
          availablePartitions={availablePartitions}
        />

        {/* Filesystem */}
        <FilesystemFields form={form} device={systemDevice} />

        {/* Filesystem additional settings (when checkbox is checked) */}
        <form.Subscribe
          selector={(s) => ({
            showMore: s.values.showMoreFilesystemSettings,
            filesystem: s.values.filesystem,
          })}
        >
          {({ showMore, filesystem }) =>
            showMore &&
            supportsAdditionalConfig(filesystem) && (
              <NestedContent margin="mxLg">
                <FilesystemAdditionalFields form={form} />
              </NestedContent>
            )
          }
        </form.Subscribe>

        {/* Size (only for new partitions) */}
        <form.Subscribe selector={(s) => s.values.name}>
          {(name) => !isReusingPartition(name) && <SizeFields form={form} />}
        </form.Subscribe>

        <ActionGroup>
          <form.SubmitButton label={_("Accept")} />
          <form.CancelButton />
        </ActionGroup>
      </Form>
    </form.AppForm>
  );
}

/**
 * Memoized, refetch-protected wrapper around {@link PartitionFormContent}.
 *
 * Freezes the result of {@link usePartitionFormContentQuery} on mount and
 * passes it as props. Query refetches update the outer wrapper but never
 * reach the form, preventing flickering and protecting user edits.
 */
const FrozenPartitionFormContent = withFrozenQuery(
  usePartitionFormContentQuery,
  PartitionFormContent,
);

/**
 * Page shell for the partition create/edit flow.
 *
 * Owns the breadcrumbs and the device null-check (Resource Not Found). Uses
 * live query data so the device name in the breadcrumb always reflects the
 * current system state. Delegates the actual form to FrozenPartitionFormContent,
 * which is protected from refetches.
 */
export default function PartitionForm() {
  const deviceModel = useDeviceModelFromParams();
  const systemDevice = useDevice(deviceModel?.name);

  const breadcrumbs: BreadcrumbProps[] = [
    // TRANSLATORS: breadcrumb label for the storage configuration section.
    { label: _("Storage"), path: STORAGE.root },
  ];

  if (deviceModel) {
    breadcrumbs.push(
      { label: deviceModel.name },
      // TRANSLATORS: breadcrumb label for the partition create/edit form.
      { label: _("Configure partition") },
    );
  } else {
    breadcrumbs.push({ label: _("Configure partition") });
  }

  return (
    <Page breadcrumbs={breadcrumbs}>
      <Page.Content>
        {!deviceModel || !systemDevice ? (
          <ResourceNotFound
            // TRANSLATORS: title of the page shown when the target device
            // does not exist. Do not end with a period.
            title={_("Device not found")}
            // TRANSLATORS: body text on the device not found page.
            body={_("The device does not exist or is no longer available.")}
            // TRANSLATORS: link text on the device not found page.
            linkText={_("Go to storage page")}
            linkPath={STORAGE.root}
          />
        ) : (
          <FrozenPartitionFormContent />
        )}
      </Page.Content>
    </Page>
  );
}
