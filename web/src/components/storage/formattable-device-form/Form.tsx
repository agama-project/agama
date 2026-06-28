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
import { withFrozenQuery } from "~/components/form/with-frozen-query";
import { useAppForm, mergeFormDefaults } from "~/hooks/form";
import { useFormSubmit } from "~/hooks/use-form-submit";
import { useConfigModel, useSetFilesystem } from "~/hooks/model/storage/config-model";
import configModel from "~/model/storage/config-model";
import { createPartitionableLocation } from "~/components/storage/utils";
import { STORAGE } from "~/routes/paths";
import { _ } from "~/i18n";

import MountPointField from "~/components/storage/shared/MountPointField";
import FilesystemAdditionalFields from "~/components/storage/shared/FilesystemAdditionalFields";
import FilesystemFields from "./FilesystemFields";
import { useDeviceModelFromParams, useDeviceFromParams, useUnusedMountPoints } from "./queries";
import { buildPayload, toFormValues } from "./transformations";
import { validate } from "./validations";
import { defaultOptions } from "./fields";

import type { Partitionable } from "~/model/storage/config-model";
import type { Storage as System } from "~/model/system";
import type { BreadcrumbProps } from "~/components/core/Breadcrumbs";

/**
 * Query data frozen on mount to protect the form from mid-interaction
 * refetches. Does not include the device model used by FormattableDeviceForm
 * for the Page shell and null-check before rendering this component at all.
 *
 * @see withFrozenQuery
 */
type FormattableDeviceFormContentQuery = {
  // Guaranteed non-null by FormattableDeviceForm's pre-render guard.
  deviceModel: Partitionable.Device | null;
  systemDevice: System.Device | undefined;
  unusedMountPoints: string[];
  config: ReturnType<typeof useConfigModel>;
};

/**
 * Aggregates the query hooks whose data feeds the form's defaultValues and
 * field options. Called at the wrapper level by withFrozenQuery.
 */
function useFormattableDeviceFormContentQuery(): FormattableDeviceFormContentQuery {
  return {
    deviceModel: useDeviceModelFromParams(),
    systemDevice: useDeviceFromParams(),
    unusedMountPoints: useUnusedMountPoints(),
    config: useConfigModel(),
  };
}

/**
 * Inner form for configuring the filesystem of a whole device (drive or MD
 * RAID).
 *
 * Receives frozen query data as props via withFrozenQuery. Mutation hooks and
 * navigation are called internally and intentionally not frozen.
 *
 * Unlike the partition and logical volume forms, there is no device selector
 * and no size fields: the whole device is always used.
 */
function FormattableDeviceFormContent({
  deviceModel,
  systemDevice,
  unusedMountPoints,
  config,
}: FormattableDeviceFormContentQuery) {
  // Route params and mutations are not frozen: they don't feed defaultValues
  // and must always reflect the current state.
  const { collection, index } = useParams();
  const navigate = useNavigate();
  const setFilesystem = useSetFilesystem();

  // Mount points already in use, excluding the current one when editing.
  const usedMountPoints = useMemo(() => {
    if (!config) return [];
    const allUsed = configModel.usedMountPaths(config);
    const currentMountPoint = deviceModel?.mountPath;
    return allUsed.filter((mp) => mp !== currentMountPoint);
  }, [config, deviceModel]);

  const { onSubmitAsync, AlertSubscribe, formSubmitHandler } = useFormSubmit<
    typeof defaultOptions.defaultValues
  >({
    scrollOnSuccess: false,
    onSubmit: async (values) => {
      const payload = buildPayload(values);
      const location = createPartitionableLocation(collection, index);
      if (!location) {
        return { error: _("Invalid device location") };
      }

      try {
        setFilesystem(location.collection, location.index, payload);
        navigate(-1);
        return { patched: true as const };
      } catch (error) {
        return { error: error instanceof Error ? error.message : String(error) };
      }
    },
  });

  const form = useAppForm({
    ...mergeFormDefaults(defaultOptions, deviceModel ? toFormValues(deviceModel) : {}),
    validators: {
      onSubmitAsync: async (ctx) => {
        const fieldErrors = validate(ctx.value, usedMountPoints);
        if (fieldErrors) return fieldErrors;

        return onSubmitAsync(ctx, form);
      },
    },
  });

  // Unreachable: FormattableDeviceForm only renders this component when the
  // device exists. The guard keeps TypeScript satisfied without a cast.
  if (!systemDevice) return null;

  return (
    <form.AppForm>
      <Form onSubmit={formSubmitHandler(form)}>
        {/* Server error alert */}
        <form.Subscribe selector={(s) => s.errorMap.onSubmit?.form}>
          {(serverError) =>
            serverError && (
              <Alert isInline variant="danger" title={_("Device could not be configured")}>
                {serverError}
              </Alert>
            )
          }
        </form.Subscribe>

        {/* Validation error alert, managed by useFormSubmit */}
        <AlertSubscribe form={form} />

        {/* Mount point */}
        <MountPointField form={form} suggestions={unusedMountPoints} />

        {/* Filesystem */}
        <FilesystemFields form={form} device={systemDevice} />

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
 * Memoized, refetch-protected wrapper around {@link FormattableDeviceFormContent}.
 */
const FrozenFormattableDeviceFormContent = withFrozenQuery(
  useFormattableDeviceFormContentQuery,
  FormattableDeviceFormContent,
);

/**
 * Page shell for the formattable device configuration flow.
 *
 * Owns the breadcrumbs and the device null-check (Resource Not Found).
 */
export default function FormattableDeviceForm() {
  const deviceModel = useDeviceModelFromParams();
  const systemDevice = useDeviceFromParams();

  const breadcrumbs: BreadcrumbProps[] = [
    // TRANSLATORS: breadcrumb label for the storage configuration section.
    { label: _("Storage"), path: STORAGE.root },
  ];

  if (deviceModel) {
    breadcrumbs.push(
      { label: deviceModel.name },
      // TRANSLATORS: breadcrumb label for the device configuration form.
      { label: _("Configure") },
    );
  } else {
    // TRANSLATORS: breadcrumb label for the device configuration form.
    breadcrumbs.push({ label: _("Configure") });
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
          <FrozenFormattableDeviceFormContent />
        )}
      </Page.Content>
    </Page>
  );
}
