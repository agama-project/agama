/*
 * Copyright (c) [2026] SUSE LLC
 *
 * All Rights Reserved.
 *
 * This program is free software; you can redistribute it and/or modify it
 * under the terms of version 2 of the GNU General Public License as published
 * by the Free Software Foundation.
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
import { useNavigate, useParams } from "react-router";
import { ActionGroup, Alert, Content, Flex, Form } from "@patternfly/react-core";
import Page from "~/components/layout/Page";
import { Icon } from "~/components/layout";
import ResourceNotFound from "~/components/core/ResourceNotFound";
import Text from "~/components/core/Text";
import { withFrozenQuery } from "~/components/form/with-frozen-query";
import { useAppForm, mergeFormDefaults } from "~/hooks/form";
import { useFormSubmit } from "~/hooks/use-form-submit";
import {
  useConfigModel,
  useAddVolumeGroup,
  useEditVolumeGroup,
} from "~/hooks/model/storage/config-model";
import { STORAGE } from "~/routes/paths";
import { _ } from "~/i18n";

import TargetDevicesField from "./TargetDevicesField";
import { useVolumeGroupConfig, useTargetDevices } from "./queries";
import { buildPayload, toFormValues, usedVolumeGroupNames } from "./transformations";
import { validate } from "./validations";
import { defaultOptions } from "./fields";

import type { ConfigModel } from "~/model/storage/config-model";
import type { Storage as System } from "~/model/system";
import type { BreadcrumbProps } from "~/components/core/Breadcrumbs";

/**
 * Explanation for a volume group that only takes the space its logical volumes
 * need, which is why its physical volumes do not cover whole disks.
 */
function UseNeededHelperText() {
  return (
    <Content>
      <Flex gap={{ default: "gapXs" }} alignItems={{ default: "alignItemsCenter" }}>
        <Icon name="emergency" />
        <Text component="span">
          {_(
            "This volume group only occupies the space required by its logical volumes. " +
              "To expand it to cover all available disk space, recreate the volume group.",
          )}
        </Text>
      </Flex>
    </Content>
  );
}

/**
 * Query data frozen on mount to protect the form from mid-interaction refetches.
 *
 * @see withFrozenQuery
 */
type VolumeGroupFormContentQuery = {
  config: ConfigModel.Config | null;
  volumeGroup: ConfigModel.VolumeGroup | null;
  devices: System.Device[];
};

/**
 * Aggregates the query hooks whose data feeds the form's defaultValues and
 * field options. Called at the wrapper level by withFrozenQuery.
 */
function useVolumeGroupFormContentQuery(): VolumeGroupFormContentQuery {
  return {
    config: useConfigModel(),
    volumeGroup: useVolumeGroupConfig(),
    devices: useTargetDevices(),
  };
}

/**
 * Inner form for creating or editing a volume group.
 *
 * Receives frozen query data as props via withFrozenQuery. Mutation hooks and
 * navigation are called internally and intentionally not frozen.
 */
function VolumeGroupFormContent({ config, volumeGroup, devices }: VolumeGroupFormContentQuery) {
  const navigate = useNavigate();
  const addVolumeGroup = useAddVolumeGroup();
  const editVolumeGroup = useEditVolumeGroup();

  // Names of the other volume groups: keeping its own name is not a duplicate.
  const usedNames = useMemo(() => usedVolumeGroupNames(config, volumeGroup), [config, volumeGroup]);

  const { onSubmitAsync, AlertSubscribe, formSubmitHandler } = useFormSubmit<
    typeof defaultOptions.defaultValues
  >({
    scrollOnSuccess: false,
    onSubmit: async (values) => {
      const payload = buildPayload(values);

      try {
        if (volumeGroup) {
          editVolumeGroup(volumeGroup.vgName, payload);
        } else {
          addVolumeGroup(payload, values.moveMountPoints);
        }

        navigate(STORAGE.root);
        return { patched: true as const };
      } catch (error) {
        return { error: error instanceof Error ? error.message : String(error) };
      }
    },
  });

  const form = useAppForm({
    ...mergeFormDefaults(defaultOptions, toFormValues(config, volumeGroup, devices)),
    validators: {
      onSubmitAsync: async (ctx) => {
        const fieldErrors = validate(ctx.value, usedNames);
        if (fieldErrors) return fieldErrors;

        return onSubmitAsync(ctx, form);
      },
    },
  });

  return (
    <form.AppForm>
      <Form onSubmit={formSubmitHandler(form)}>
        {/* Server error alert */}
        <form.Subscribe selector={(s) => s.errorMap.onSubmit?.form}>
          {(serverError) =>
            serverError && (
              <Alert isInline variant="danger" title={_("Volume group could not be configured")}>
                {serverError}
              </Alert>
            )
          }
        </form.Subscribe>

        {/* Validation error alert, managed by useFormSubmit */}
        <AlertSubscribe form={form} />

        <form.AppField name="vgName">
          {(field) => <field.TextField label={_("Name")} />}
        </form.AppField>

        <TargetDevicesField form={form} devices={devices} />

        {volumeGroup?.targetDevicesPolicy === "useNeeded" && <UseNeededHelperText />}

        {/* Only a new volume group has mount points to take over */}
        {!volumeGroup && (
          <form.AppField name="moveMountPoints">
            {(field) => (
              <field.CheckboxField
                label={_(
                  "Move the mount points currently configured at the selected disks to logical " +
                    "volumes of this volume group.",
                )}
              />
            )}
          </form.AppField>
        )}

        <ActionGroup>
          <form.SubmitButton label={_("Accept")} />
          <form.CancelButton />
        </ActionGroup>
      </Form>
    </form.AppForm>
  );
}

/**
 * Memoized, refetch-protected wrapper around {@link VolumeGroupFormContent}.
 */
const FrozenVolumeGroupFormContent = withFrozenQuery(
  useVolumeGroupFormContentQuery,
  VolumeGroupFormContent,
);

/**
 * Page shell for the volume group create/edit flow.
 *
 * Owns the breadcrumbs and the volume group null-check (Resource Not Found)
 * for the edit route.
 */
export default function VolumeGroupForm() {
  const { id } = useParams();
  const volumeGroup = useVolumeGroupConfig();

  const breadcrumbs: BreadcrumbProps[] = [
    // TRANSLATORS: breadcrumb label for the storage configuration section.
    { label: _("Storage"), path: STORAGE.root },
    // TRANSLATORS: breadcrumb label for the LVM configuration section.
    { label: _("LVM") },
    // TRANSLATORS: breadcrumb label for the volume group create/edit form.
    { label: _("Configure Volume Group") },
  ];

  // Without an id the form creates a volume group. With one, it has to exist.
  const isMissing = id !== undefined && !volumeGroup;

  return (
    <Page breadcrumbs={breadcrumbs}>
      <Page.Content>
        {isMissing ? (
          <ResourceNotFound
            // TRANSLATORS: link text on the volume group not found page.
            linkText={_("Go to storage page")}
            linkPath={STORAGE.root}
          />
        ) : (
          <FrozenVolumeGroupFormContent />
        )}
      </Page.Content>
    </Page>
  );
}
