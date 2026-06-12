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
import Page from "~/components/core/Page";
import ResourceNotFound from "~/components/core/ResourceNotFound";
import NestedContent from "~/components/core/NestedContent";
import { createPartitionableLocation } from "~/components/storage/utils";
import { withFrozenQuery } from "~/components/form/with-frozen-query";
import { useAppForm, mergeFormDefaults } from "~/hooks/form";
import { useFormSubmit } from "~/hooks/use-form-submit";
import { useDevice } from "~/hooks/model/system/storage";
import {
  useConfigModel,
  useAddPartition,
  useEditPartition,
} from "~/hooks/model/storage/config-model";
import configModel from "~/model/storage/config-model";
import { STORAGE } from "~/routes/paths";
import { _ } from "~/i18n";

import MountPointField from "~/components/storage/shared/MountPointField";
import SizeFields from "~/components/storage/shared/SizeFields";
import PartitionFields from "./PartitionFields";
import FilesystemAdditionalFields from "~/components/storage/shared/FilesystemAdditionalFields";
import FilesystemFields from "./FilesystemFields";
import {
  useDeviceModelFromParams,
  useInitialPartitionConfig,
  useUnusedMountPoints,
  useUnusedPartitions,
} from "./queries";
import { buildPayload, toFormValues, useSolvedSizes } from "./transformations";
import { validate } from "./validations";
import { defaultOptions, isReusingPartition } from "./fields";

import type { ConfigModel as ConfigModelType } from "~/model/storage/config-model";
import type { Storage as System } from "~/model/system";
import type { BreadcrumbProps } from "~/components/core/Breadcrumbs";

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
 *
 * ## Patterns Used
 *
 * ### withFrozenQuery (see withFrozenQuery.tsx)
 * Wraps this component so it receives frozen initial config as props.
 * Query refetches never reach this component, preventing flickering and
 * protecting user edits.
 *
 * ### useFormSubmit (see useFormSubmit.tsx)
 * Encapsulates the submit lifecycle for forms that navigate away:
 * - Validation error alerts via refs + Subscribe (no extra re-renders)
 * - Server error handling
 * - Clean error state management
 *
 * ### Field validation
 * Stays in useAppForm's validators.onSubmitAsync where TanStack Form expects it.
 * useFormSubmit's onSubmit is only called after field validation passes.
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
  // Memoized to maintain stable array reference for form validators.
  const usedMountPoints = useMemo(() => {
    if (!config) return [];
    const allUsed = configModel.usedMountPaths(config);
    const currentMountPoint = initialPartition?.mountPath;
    return allUsed.filter((mp) => mp !== currentMountPoint);
  }, [config, initialPartition]);

  // useFormSubmit is initialized before useAppForm so we can pass onSubmitAsync
  // directly into the validators option — no mutation, no two-phase wiring.
  const { onSubmitAsync, AlertSubscribe, formSubmitHandler } = useFormSubmit<
    typeof defaultOptions.defaultValues
  >({
    scrollOnSuccess: false,
    onSubmit: async (values) => {
      const payload = buildPayload(values);
      const partitionableLocation = createPartitionableLocation(collection, index);
      if (!partitionableLocation) {
        return { error: _("Invalid partition location") };
      }

      try {
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
        return { patched: true as const };
      } catch (error) {
        return { error: error instanceof Error ? error.message : String(error) };
      }
    },
  });

  const form = useAppForm({
    ...mergeFormDefaults(defaultOptions, toFormValues(initialPartition)),
    validators: {
      onSubmitAsync: async (ctx) => {
        // Field validation runs first. If it fails, TanStack Form surfaces
        // errors per field and onSubmitAsync (business logic) is not called.
        const fieldErrors = validate(ctx.value, usedMountPoints);
        if (fieldErrors) return fieldErrors;

        // Business logic: payload building + API call.
        return onSubmitAsync(ctx, form);
      },
    },
  });

  // Unreachable: PartitionForm only renders this component when systemDevice
  // is defined. The guard keeps TypeScript satisfied without a cast.
  if (!systemDevice) return null;

  return (
    <form.AppForm>
      <Form onSubmit={formSubmitHandler(form)}>
        {/* Server error alert */}
        <form.Subscribe selector={(s) => s.errorMap.onSubmit?.form}>
          {(serverError) =>
            serverError && (
              <Alert isInline variant="danger" title={_("Partition could not be configured")}>
                {serverError}
              </Alert>
            )
          }
        </form.Subscribe>

        {/* Validation error alert — managed by useFormSubmit */}
        <AlertSubscribe form={form} />

        {/* Mount point */}
        <MountPointField form={form} suggestions={unusedMountPoints} />

        {/* Partition */}
        <PartitionFields
          form={form}
          device={systemDevice}
          availablePartitions={availablePartitions}
        />

        {/* Size (only for new partitions) */}
        <form.Subscribe selector={(s) => s.values.name}>
          {(name) =>
            !isReusingPartition(name) && <SizeFields form={form} useSolvedSizes={useSolvedSizes} />
          }
        </form.Subscribe>

        {/* Filesystem */}
        <FilesystemFields form={form} device={systemDevice} />

        {/* Filesystem additional settings (when checkbox is checked) */}
        <form.Subscribe
          selector={(s) => ({
            showMore: s.values.showMoreFilesystemSettings,
            filesystem: s.values.filesystem,
          })}
        >
          {({ showMore }) =>
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
