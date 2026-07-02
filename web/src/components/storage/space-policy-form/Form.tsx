/*
 * Copyright (c) [2024-2026] SUSE LLC
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
import { ActionGroup, Divider, Form } from "@patternfly/react-core";
import { sprintf } from "sprintf-js";
import { useNavigate, useParams } from "react-router";
import { Page, SubtleContent } from "~/components/core";
import DeviceActionFields from "./DeviceActionFields";
import { deviceChildren } from "~/components/storage/utils";
import { useDevice } from "~/hooks/model/system/storage";
import {
  useDevice as useDeviceConfig,
  useSetSpacePolicy,
  useConfigModel,
} from "~/hooks/model/storage/config-model";
import { toDevice } from "~/components/storage/device-utils";
import { STORAGE } from "~/routes/paths";
import { _ } from "~/i18n";
import configModel from "~/model/storage/config-model";
import { isVolumeGroup } from "~/model/storage/device";
import { useAppForm } from "~/hooks/form";
import { toFormValues, buildPayload } from "./transformations";
import type { DeviceCollection, ConfigModel } from "~/model/storage/config-model";

function useDeviceParams(): [DeviceCollection, number] {
  const { collection, index } = useParams();
  return [collection as DeviceCollection, Number(index)];
}

/**
 * Volumes (partitions or logical volumes) reused by the new system, across the
 * whole configuration. A device listed here is kept as is: it can be neither
 * shrunk nor deleted, so it offers no action to choose.
 *
 * Computed once for the whole form instead of per device, so the field for each
 * child can simply look itself up by name.
 */
function useUsedVolumes(): ConfigModel.Partition[] {
  const config = useConfigModel();

  return useMemo(() => {
    if (!config) return [];

    return configModel
      .devices(config)
      .flatMap((d) => configModel.device.volumes(d))
      .filter((v) => configModel.volume.isUsed(v));
  }, [config]);
}

/**
 * Space policy form for selecting actions on devices.
 *
 * Uses dropdown + ReadOnlyField pattern:
 * - ReadOnlyField when only 1 action available (no fake choice)
 * - DropdownField when 2-3 actions available (shows ONLY enabled options)
 * - Helper text explains constraints without cluttering dropdown
 *
 * Follows form conventions from partition-form and system-form.
 */
export default function SpacePolicyForm() {
  const [collection, index] = useDeviceParams();
  const deviceConfig = useDeviceConfig(collection, index);
  const device = useDevice(deviceConfig.name);
  const setSpacePolicy = useSetSpacePolicy();
  const navigate = useNavigate();

  const children = deviceChildren(device);
  const usedVolumes = useUsedVolumes();

  // Form state: one field per device (deviceName: action)
  const form = useAppForm({
    defaultValues: toFormValues(children, deviceConfig),
    onSubmit: async ({ value }) => {
      const actions = buildPayload(value);
      await setSpacePolicy(collection, index, {
        type: "custom",
        actions,
      });
      navigate("..");
    },
  });

  const description = (): string => {
    if (isVolumeGroup(device)) {
      return _(
        "Select what to do with each logical volume in order to find space for allocating the new system.",
      );
    }

    return _(
      "Select what to do with each partition in order to find space for allocating the new system.",
    );
  };

  return (
    <Page
      breadcrumbs={[
        { label: _("Storage"), path: STORAGE.root },
        { label: sprintf(_("Find space in %s"), device.name) },
      ]}
    >
      <Page.Content>
        <SubtleContent>{description()}</SubtleContent>
        <Divider />
        <form.AppForm>
          <Form
            id="space-policy-form"
            onSubmit={(e) => {
              e.preventDefault();
              form.handleSubmit();
            }}
          >
            {children.map((child) => {
              const childDevice = toDevice(child);
              if (!childDevice) return null;

              return (
                <DeviceActionFields
                  key={childDevice.name}
                  form={form}
                  device={childDevice}
                  deviceConfig={deviceConfig}
                  reusedPartition={usedVolumes.find((v) => v.name === childDevice.name)}
                />
              );
            })}
            <ActionGroup>
              <Page.Submit form="space-policy-form" />
              <Page.Cancel />
            </ActionGroup>
          </Form>
        </form.AppForm>
      </Page.Content>
    </Page>
  );
}
