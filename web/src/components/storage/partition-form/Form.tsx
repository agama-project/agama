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
import { ActionGroup, Form } from "@patternfly/react-core";
import { useParams, useNavigate } from "react-router-dom";
import Page from "~/components/core/Page";
import { useAppForm, mergeFormDefaults } from "~/hooks/form";
import { useDevice } from "~/hooks/model/system/storage";
import {
  useConfigModel,
  useMissingMountPaths,
  usePartitionable,
  useAddPartition,
  useEditPartition,
} from "~/hooks/model/storage/config-model";
import {
  deviceSize,
  createPartitionableLocation,
  parseToBytes,
} from "~/components/storage/utils";
import configModel from "~/model/storage/config-model";
import { compact } from "~/utils";
import { _ } from "~/i18n";
import { STORAGE } from "~/routes/paths";

import PartitionSourceFields from "./PartitionSourceFields";
import FilesystemFields from "./FilesystemFields";
import SizeFields from "./SizeFields";
import {
  defaultOptions,
  validate,
  PARTITION_SOURCE,
  FILESYSTEM_TYPE,
  FILESYSTEM_ACTION,
  SIZE_MODE,
} from "./fields";

import type { ConfigModel as ConfigModelType, Partitionable } from "~/model/storage/config-model";
import type { Storage as System } from "~/model/system";

function useDeviceModelFromParams(): Partitionable.Device | null {
  const { collection, index } = useParams();
  const location = createPartitionableLocation(collection, index);
  if (!location) return null;
  return usePartitionable(location.collection, location.index);
}

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
  if (!deviceModel) return [];

  const systemDevice = useDevice(deviceModel.name);
  const allPartitions = systemDevice?.partitions || [];
  const initialPartitionConfig = useInitialPartitionConfig();
  const configuredPartitionConfigs = configModel.partitionable
    .filterConfiguredExistingPartitions(deviceModel)
    .filter((p) => p.name !== initialPartitionConfig?.name)
    .map((p) => p.name);

  return allPartitions.filter((p) => !configuredPartitionConfigs.includes(p.name));
}

/** Build config model partition from form values */
function buildPayload(values: typeof defaultOptions.defaultValues): ConfigModelType.Partition {
  // Partition name (only for reuse)
  const name = (): string | undefined => {
    if (values.partitionSource !== PARTITION_SOURCE.REUSE) return undefined;
    return values.selectedPartitionId || undefined;
  };

  // Filesystem configuration
  const filesystem = (): ConfigModelType.Filesystem | undefined => {
    // Reuse existing filesystem
    if (
      values.partitionSource === PARTITION_SOURCE.REUSE &&
      values.filesystemAction === FILESYSTEM_ACTION.REUSE
    ) {
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

    if (values.sizeMode === SIZE_MODE.RANGE || values.sizeMode === SIZE_MODE.EXPAND) {
      return values.minSize
        ? {
            default: false,
            min: parseToBytes(values.minSize),
            max: values.maxSize ? parseToBytes(values.maxSize) : undefined,
          }
        : undefined;
    }

    return undefined;
  };

  return {
    mountPath: values.mountPoint,
    name: name(),
    filesystem: filesystem(),
    size: size(),
  };
}

/** Convert partition config to form initial values */
function toFormValues(
  partitionConfig: ConfigModelType.Partition | null,
): Partial<typeof defaultOptions.defaultValues> {
  if (!partitionConfig) return {};

  const isReuse = partitionConfig.name !== undefined;
  const fsConfig = partitionConfig.filesystem;
  const isReuseFs = fsConfig?.reuse === true;

  // Determine size mode
  let sizeMode = SIZE_MODE.AUTO;
  let minSize = "";
  let maxSize = "";
  let fixedSize = "";

  if (!isReuse && partitionConfig.size && !partitionConfig.size.default) {
    const sizeConfig = partitionConfig.size;
    if (sizeConfig.min !== undefined) {
      minSize = deviceSize(sizeConfig.min, { exact: true });
      if (sizeConfig.max !== undefined) {
        maxSize = deviceSize(sizeConfig.max, { exact: true });
        if (sizeConfig.min === sizeConfig.max) {
          sizeMode = SIZE_MODE.FIXED;
          fixedSize = minSize;
          minSize = "";
          maxSize = "";
        } else {
          sizeMode = SIZE_MODE.RANGE;
        }
      } else {
        sizeMode = SIZE_MODE.EXPAND;
      }
    }
  }

  return {
    mountPoint: partitionConfig.mountPath || "",
    partitionSource: isReuse ? PARTITION_SOURCE.REUSE : PARTITION_SOURCE.NEW,
    selectedPartitionId: partitionConfig.name || "",
    filesystem: isReuseFs ? FILESYSTEM_TYPE.AUTO : (fsConfig?.type || FILESYSTEM_TYPE.AUTO),
    filesystemAction: isReuseFs ? FILESYSTEM_ACTION.REUSE : FILESYSTEM_ACTION.FORMAT,
    filesystemLabel: fsConfig?.label || "",
    sizeMode,
    minSize,
    maxSize,
    fixedSize,
  };
}

/**
 * Form for creating or editing a partition.
 *
 * Allows configuring:
 * - Mount point (with suggestions)
 * - Partition source (new vs use existing)
 * - Filesystem type and label
 * - Size settings (only for new partitions)
 */
export default function PartitionForm() {
  const { collection, index } = useParams();
  const navigate = useNavigate();

  const deviceModel = useDeviceModelFromParams();
  const systemDevice = useDevice(deviceModel?.name);
  const availablePartitions = useUnusedPartitions();
  const initialPartition = useInitialPartitionConfig();
  const unusedMountPoints = useUnusedMountPoints();
  const config = useConfigModel();

  const addPartition = useAddPartition();
  const editPartition = useEditPartition();

  // Get used mount points for validation (excluding current when editing)
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

  if (!deviceModel || !systemDevice) {
    return null;
  }

  return (
    <form.AppForm>
      <Page>
        <Page.Header>
          <h2>{initialPartition ? _("Edit partition") : _("Add partition")}</h2>
        </Page.Header>

        <Page.Content>
          <Form
            onSubmit={(e) => {
              e.preventDefault();
              form.setErrorMap({ onSubmit: { fields: {} } });
              form.handleSubmit();
            }}
          >
            {/* Mount point */}
            <form.AppField name="mountPoint">
              {(field) => (
                <field.SuggestionsTextField
                  label={_("Mount point")}
                  suggestions={unusedMountPoints}
                  helperText={_("e.g., /, /home, /var, swap")}
                />
              )}
            </form.AppField>

            {/* Partition source */}
            <PartitionSourceFields
              form={form}
              device={systemDevice}
              availablePartitions={availablePartitions}
            />

            {/* Filesystem */}
            <FilesystemFields form={form} device={systemDevice} />

            {/* Size (only for new partitions) */}
            <form.Subscribe selector={(s) => s.values.partitionSource}>
              {(source) => source === PARTITION_SOURCE.NEW && <SizeFields form={form} />}
            </form.Subscribe>

            <ActionGroup>
              <form.SubmitButton label={_("Accept")} />
              <form.CancelButton onClick={() => navigate(-1)} />
            </ActionGroup>
          </Form>
        </Page.Content>
      </Page>
    </form.AppForm>
  );
}
