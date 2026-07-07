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

import React, { useState } from "react";
import { ActionGroup, Divider, Form } from "@patternfly/react-core";
import { sprintf } from "sprintf-js";
import { useNavigate, useParams } from "react-router";
import { Page, SubtleContent } from "~/components/core";
import SpaceActionsTable, { SpacePolicyAction } from "~/components/storage/SpaceActionsTable";
import { deviceChildren } from "~/components/storage/utils";
import { useDevice } from "~/hooks/model/system/storage";
import {
  useDevice as useDeviceConfig,
  useSetSpacePolicy,
} from "~/hooks/model/storage/config-model";
import { toDevice } from "~/components/storage/device-utils";
import { STORAGE } from "~/routes/paths";
import { _ } from "~/i18n";
import configModel from "~/model/storage/config-model";
import type { Storage as System } from "~/model/system";
import type { DeviceCollection } from "~/model/storage/config-model";
import { isVolumeGroup } from "~/model/storage/device";

type Action = "delete" | "resizeIfNeeded";

function useDeviceParams(): [DeviceCollection, number] {
  const { collection, index } = useParams();

  return [collection as DeviceCollection, Number(index)];
}

/**
 * Renders a page that allows the user to select the space policy and actions.
 */
export default function SpacePolicySelectionPage() {
  const [collection, index] = useDeviceParams();
  const deviceConfig = useDeviceConfig(collection, index);
  const device = useDevice(deviceConfig.name);
  const setSpacePolicy = useSetSpacePolicy();
  const navigate = useNavigate();

  const children = deviceChildren(device);

  const volumeDeviceAction = (volumeDevice: System.Device): Action | null => {
    const volumeConfig = configModel.device
      .volumes(deviceConfig)
      .find((v) => v.name === volumeDevice.name);

    if (!volumeConfig) return null;

    if (volumeConfig.delete) return "delete";

    if (volumeConfig.resizeIfNeeded) return "resizeIfNeeded";
  };

  const [actions, setActions] = useState(
    children
      .filter((d) => toDevice(d) && volumeDeviceAction(toDevice(d)))
      .map((d: System.Device): SpacePolicyAction => ({
        deviceName: toDevice(d).name,
        value: volumeDeviceAction(toDevice(d)),
      })),
  );

  const deviceAction = (device: System.Device | System.UnusedSlot) => {
    if (toDevice(device) === undefined) return "keep";

    return actions.find((a) => a.deviceName === toDevice(device).name)?.value || "keep";
  };

  const changeActions = (spaceAction: SpacePolicyAction) => {
    const spaceActions = actions.filter((a) => a.deviceName !== spaceAction.deviceName);
    spaceActions.push(spaceAction);

    setActions(spaceActions);
  };

  const onSubmit = (e) => {
    e.preventDefault();

    setSpacePolicy(collection, index, { type: "custom", actions });
    navigate("..");
  };

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
        <Form id="space-policy-form" onSubmit={onSubmit}>
          <SpaceActionsTable
            devices={children}
            deviceAction={deviceAction}
            onActionChange={changeActions}
          />
          <ActionGroup>
            <Page.Submit form="space-policy-form" type="submit" />
            <Page.Cancel />
          </ActionGroup>
        </Form>
      </Page.Content>
    </Page>
  );
}
