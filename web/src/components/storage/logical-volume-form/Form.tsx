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

import React, { useMemo } from "react";
import { useParams, useNavigate } from "react-router";
import { ActionGroup, Alert, Form } from "@patternfly/react-core";
import { isEmpty } from "radashi";
import Page from "~/components/core/Page";
import ResourceNotFound from "~/components/core/ResourceNotFound";
import NestedContent from "~/components/core/NestedContent";
import { withFrozenQuery } from "~/components/form/with-frozen-query";
import { useAppForm, mergeFormDefaults } from "~/hooks/form";
import { useFormSubmit } from "~/hooks/use-form-submit";
import {
  useConfigModel,
  useAddLogicalVolume,
  useEditLogicalVolume,
} from "~/hooks/model/storage/config-model";
import configModel from "~/model/storage/config-model";
import { deviceSize, parseToBytes } from "~/components/storage/utils";
import { STORAGE } from "~/routes/paths";
import { _ } from "~/i18n";

import MountPointField from "~/components/storage/shared/MountPointField";
import SizeFields from "~/components/storage/shared/SizeFields";
import FilesystemAdditionalFields from "~/components/storage/shared/FilesystemAdditionalFields";
import LogicalVolumeSourceFields from "./LogicalVolumeSourceFields";
import LogicalVolumeNameField from "./LogicalVolumeNameField";
import FilesystemFields from "./FilesystemFields";
import { useSolvedSizes } from "./use-solved-sizes";
import {
  useVolumeGroupConfig,
  useVolumeGroup,
  useUnusedLogicalVolumes,
  useInitialLogicalVolumeConfig,
  useUnusedMountPoints,
} from "./queries";
import {
  defaultOptions,
  validate,
  isReusingLogicalVolume,
  FILESYSTEM_TYPE,
  FILESYSTEM_ACTION,
  SIZE_MODE,
  type SizeMode,
} from "./fields";

import type { ConfigModel as ConfigModelType } from "~/model/storage/config-model";
import type { Storage as System } from "~/model/system";
import type { BreadcrumbProps } from "~/components/core/Breadcrumbs";

/**
 * Derives the logical volume name from a mount point: "/home" -> "home",
 * "/var/lib" -> "var_lib", "swap" -> "swap".
 */
function lvNameFromMountPoint(mountPoint: string): string {
  if (mountPoint === "") return "";
  if (mountPoint === "swap") return "swap";
  return mountPoint.replace(/^\//, "").replace(/\//g, "_");
}

/**
 * Auto-fills the logical volume name from the committed mount point until the
 * user edits the name manually. Only applies when creating a new logical volume.
 *
 * @see ~/components/form/conventions.md (auto-fill pattern)
 */
function syncLvName(formApi): void {
  // Stop auto-filling once the user has manually edited the name.
  if (formApi.getFieldMeta("lvName")?.isDirty) return;
  // The name is only used when creating a new logical volume.
  if (isReusingLogicalVolume(formApi.getFieldValue("target"))) return;

  const mountPoint = formApi.getFieldValue("committedMountPoint");
  formApi.setFieldValue("lvName", lvNameFromMountPoint(mountPoint), {
    dontUpdateMeta: true,
    dontRunListeners: true,
  });
}

/** Maps a stored filesystem config to the `filesystem` field value. */
function fsConfigValue(fsConfig: ConfigModelType.Filesystem | undefined): string {
  if (fsConfig?.default) return FILESYSTEM_TYPE.AUTO;
  return fsConfig?.type || FILESYSTEM_TYPE.AUTO;
}

/**
 * Infers the size form fields from a stored logical volume config. Reusing an
 * existing logical volume keeps automatic sizing.
 */
function inferSizeFields(logicalVolumeConfig: ConfigModelType.LogicalVolume): {
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

  const isReuse = logicalVolumeConfig.name !== undefined;
  if (isReuse) return defaults;

  const sizeConfig = logicalVolumeConfig.size;
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
 * Maps a stored logical volume config to initial form values for editing, or
 * returns an empty object when creating a new logical volume.
 */
function toFormValues(
  logicalVolumeConfig: ConfigModelType.LogicalVolume | null,
): Partial<typeof defaultOptions.defaultValues> {
  if (!logicalVolumeConfig) return {};

  const fsConfig = logicalVolumeConfig.filesystem;
  const isReuse = logicalVolumeConfig.name !== undefined;

  // When editing a reused logical volume that has a filesystem, default to
  // keeping it unless the config explicitly says to format (reuse: false).
  const shouldKeepFilesystem = isReuse && fsConfig?.type !== undefined && fsConfig.reuse !== false;

  const mountPoint = logicalVolumeConfig.mountPath || "";
  const filesystemLabel = fsConfig?.label || "";
  const mkfsOptions = fsConfig?.mkfsOptions || [];
  const mountOptions = fsConfig?.mountOptions || [];
  const showMoreFilesystemSettings =
    filesystemLabel !== "" || !!mkfsOptions.length || !!mountOptions.length;

  return {
    mountPoint,
    committedMountPoint: mountPoint,
    target: logicalVolumeConfig.name || "",
    lvName: logicalVolumeConfig.lvName || "",
    filesystem: shouldKeepFilesystem ? FILESYSTEM_ACTION.REUSE : fsConfigValue(fsConfig),
    filesystemAction: shouldKeepFilesystem ? FILESYSTEM_ACTION.REUSE : FILESYSTEM_ACTION.FORMAT,
    filesystemLabel,
    mkfsOptions,
    mountOptions,
    showMoreFilesystemSettings,
    ...inferSizeFields(logicalVolumeConfig),
  };
}

/**
 * Builds a logical volume config from the validated form values. Size is
 * omitted when reusing; filesystem and size are omitted when their modes select
 * automatic behavior.
 */
function buildPayload(values: typeof defaultOptions.defaultValues): ConfigModelType.LogicalVolume {
  const isReuse = isReusingLogicalVolume(values.target);

  const fsExtraSetting = (attr: "filesystemLabel" | "mkfsOptions" | "mountOptions") => {
    if (!values.showMoreFilesystemSettings) return undefined;
    if (isEmpty(values[attr])) return undefined;
    return values[attr];
  };

  const filesystem = (): ConfigModelType.Filesystem | undefined => {
    if (values.filesystem === FILESYSTEM_ACTION.REUSE) {
      return {
        reuse: true,
        default: true,
        mountOptions: (fsExtraSetting("mountOptions") as string[]) || undefined,
      };
    }

    if (values.filesystem === FILESYSTEM_TYPE.AUTO) {
      return {
        default: true,
        label: (fsExtraSetting("filesystemLabel") as string) || undefined,
        mkfsOptions: (fsExtraSetting("mkfsOptions") as string[]) || undefined,
        mountOptions: (fsExtraSetting("mountOptions") as string[]) || undefined,
      };
    }

    return {
      default: false,
      type: values.filesystem as ConfigModelType.FilesystemType,
      label: (fsExtraSetting("filesystemLabel") as string) || undefined,
      mkfsOptions: (fsExtraSetting("mkfsOptions") as string[]) || undefined,
      mountOptions: (fsExtraSetting("mountOptions") as string[]) || undefined,
    };
  };

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
        ? { default: false, min: parseToBytes(values.expandMinSize) }
        : undefined;
    }

    return undefined;
  };

  return {
    mountPath: values.mountPoint,
    lvName: values.lvName,
    name: isReuse ? values.target : undefined,
    filesystem: filesystem(),
    size: size(),
  };
}

/**
 * Query data frozen on mount to protect the form from mid-interaction refetches.
 *
 * @see withFrozenQuery
 */
type LogicalVolumeFormContentQuery = {
  volumeGroupConfig: ConfigModelType.VolumeGroup;
  volumeGroup: System.Device | undefined;
  availableLogicalVolumes: System.Device[];
  initialLogicalVolume: ConfigModelType.LogicalVolume | null;
  unusedMountPoints: string[];
  config: ReturnType<typeof useConfigModel>;
};

/**
 * Aggregates the query hooks whose data feeds the form's defaultValues and
 * field options. Called at the wrapper level by withFrozenQuery.
 */
function useLogicalVolumeFormContentQuery(): LogicalVolumeFormContentQuery {
  return {
    // Guaranteed non-null by LogicalVolumeForm's pre-render guard.
    volumeGroupConfig: useVolumeGroupConfig() as ConfigModelType.VolumeGroup,
    volumeGroup: useVolumeGroup(),
    availableLogicalVolumes: useUnusedLogicalVolumes(),
    initialLogicalVolume: useInitialLogicalVolumeConfig(),
    unusedMountPoints: useUnusedMountPoints(),
    config: useConfigModel(),
  };
}

/**
 * Inner form for creating or editing a logical volume.
 *
 * Receives frozen query data as props via withFrozenQuery. Mutation hooks and
 * navigation are called internally and intentionally not frozen.
 */
function LogicalVolumeFormContent({
  volumeGroup,
  availableLogicalVolumes,
  initialLogicalVolume,
  unusedMountPoints,
  config,
}: LogicalVolumeFormContentQuery) {
  const { id } = useParams();
  const volumeGroupIndex = Number(id);
  const navigate = useNavigate();
  const addLogicalVolume = useAddLogicalVolume();
  const editLogicalVolume = useEditLogicalVolume();

  // Mount points already in use, excluding the current one when editing.
  const usedMountPoints = useMemo(() => {
    if (!config) return [];
    const allUsed = configModel.usedMountPaths(config);
    const currentMountPoint = initialLogicalVolume?.mountPath;
    return allUsed.filter((mp) => mp !== currentMountPoint);
  }, [config, initialLogicalVolume]);

  const { onSubmitAsync, AlertSubscribe, formSubmitHandler } = useFormSubmit<
    typeof defaultOptions.defaultValues
  >({
    scrollOnSuccess: false,
    onSubmit: async (values) => {
      const payload = buildPayload(values);

      try {
        if (initialLogicalVolume) {
          editLogicalVolume(volumeGroupIndex, initialLogicalVolume.mountPath, payload);
        } else {
          addLogicalVolume(volumeGroupIndex, payload);
        }

        navigate(-1);
        return { patched: true as const };
      } catch (error) {
        return { error: error instanceof Error ? error.message : String(error) };
      }
    },
  });

  const form = useAppForm({
    ...mergeFormDefaults(defaultOptions, toFormValues(initialLogicalVolume)),
    validators: {
      onSubmitAsync: async (ctx) => {
        const fieldErrors = validate(ctx.value, usedMountPoints);
        if (fieldErrors) return fieldErrors;

        return onSubmitAsync(ctx, form);
      },
    },
    listeners: {
      // Initial auto-fill of the logical volume name from the mount point.
      onMount: ({ formApi }) => syncLvName(formApi),
    },
  });

  return (
    <form.AppForm>
      <Form onSubmit={formSubmitHandler(form)}>
        {/* Server error alert */}
        <form.Subscribe selector={(s) => s.errorMap.onSubmit?.form}>
          {(serverError) =>
            serverError && (
              <Alert isInline variant="danger" title={_("Logical volume could not be configured")}>
                {serverError}
              </Alert>
            )
          }
        </form.Subscribe>

        {/* Validation error alert, managed by useFormSubmit */}
        <AlertSubscribe form={form} />

        {/* Mount point */}
        <MountPointField form={form} suggestions={unusedMountPoints} />

        {/* Re-sync the logical volume name when the committed mount point changes.
         * Rendered without UI: it only registers the field listener. */}
        <form.AppField name="committedMountPoint" listeners={{ onChange: () => syncLvName(form) }}>
          {() => null}
        </form.AppField>

        {/* Logical volume source (only when the volume group already exists) */}
        <LogicalVolumeSourceFields
          form={form}
          volumeGroup={volumeGroup}
          availableLogicalVolumes={availableLogicalVolumes}
        />

        {/* Logical volume name (only when creating a new logical volume) */}
        <form.Subscribe selector={(s) => s.values.target}>
          {(target) => !isReusingLogicalVolume(target) && <LogicalVolumeNameField form={form} />}
        </form.Subscribe>

        {/* Size (only when creating a new logical volume) */}
        <form.Subscribe selector={(s) => s.values.target}>
          {(target) =>
            !isReusingLogicalVolume(target) && (
              <SizeFields form={form} useSolvedSizes={useSolvedSizes} />
            )
          }
        </form.Subscribe>

        {/* Filesystem */}
        <FilesystemFields form={form} volumeGroup={volumeGroup} />

        {/* Filesystem additional settings (when checkbox is checked) */}
        <form.Subscribe selector={(s) => s.values.showMoreFilesystemSettings}>
          {(showMore) =>
            showMore && (
              <NestedContent margin="mxLg">
                <FilesystemAdditionalFields form={form} />
              </NestedContent>
            )
          }
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
 * Memoized, refetch-protected wrapper around {@link LogicalVolumeFormContent}.
 */
const FrozenLogicalVolumeFormContent = withFrozenQuery(
  useLogicalVolumeFormContentQuery,
  LogicalVolumeFormContent,
);

/**
 * Page shell for the logical volume create/edit flow.
 *
 * Owns the breadcrumbs and the volume group null-check (Resource Not Found).
 */
export default function LogicalVolumeForm() {
  const volumeGroupConfig = useVolumeGroupConfig();

  const breadcrumbs: BreadcrumbProps[] = [
    // TRANSLATORS: breadcrumb label for the storage configuration section.
    { label: _("Storage"), path: STORAGE.root },
  ];

  if (volumeGroupConfig) {
    breadcrumbs.push(
      { label: volumeGroupConfig.name },
      // TRANSLATORS: breadcrumb label for the logical volume create/edit form.
      { label: _("Configure logical volume") },
    );
  } else {
    breadcrumbs.push({ label: _("Configure logical volume") });
  }

  return (
    <Page breadcrumbs={breadcrumbs}>
      <Page.Content>
        {volumeGroupConfig ? (
          <FrozenLogicalVolumeFormContent />
        ) : (
          <ResourceNotFound
            // TRANSLATORS: link text on the volume group not found page.
            linkText={_("Go to storage page")}
            linkPath={STORAGE.root}
          />
        )}
      </Page.Content>
    </Page>
  );
}
