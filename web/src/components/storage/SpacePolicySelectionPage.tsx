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
import { createPartitionableLocation, deviceChildren } from "~/components/storage/utils";
import { useDevices } from "~/hooks/model/system/storage";
import { usePartitionable, useSetSpacePolicy } from "~/hooks/model/storage/config-model";
import { toDevice } from "~/components/storage/device-utils";
import { STORAGE } from "~/routes/paths";
import { _ } from "~/i18n";

import type { Storage as Proposal } from "~/model/proposal";
import type { ConfigModel, Partitionable } from "~/model/storage/config-model";

const partitionAction = (partition: ConfigModel.Partition) => {
  if (partition.delete) return "delete";
  if (partition.resizeIfNeeded) return "resizeIfNeeded";

  return undefined;
};

function useDeviceModelFromParams(): Partitionable.Device | null {
  const { collection, index } = useParams();
  const location = createPartitionableLocation(collection, index);
  const deviceModel = usePartitionable(location.collection, location.index);

  return deviceModel;
}

/**
 * Renders a page that allows the user to select the space policy and actions.
 */
export default function SpacePolicySelectionPage() {
  const deviceModel = useDeviceModelFromParams();
  const devices = useDevices();
  const device = devices.find((d) => d.name === deviceModel.name);
  const children = deviceChildren(device);
  const setSpacePolicy = useSetSpacePolicy();
  const { collection, index } = useParams();

  const partitionDeviceAction = (device: Proposal.Device) => {
    const partition = deviceModel.partitions?.find((p) => p.name === device.name);

    return partition ? partitionAction(partition) : undefined;
  };

  const [actions, setActions] = useState(
    children
      .filter((d) => toDevice(d) && partitionDeviceAction(toDevice(d)))
      .map(
        (d: Proposal.Device): SpacePolicyAction => ({
          deviceName: toDevice(d).name,
          value: partitionDeviceAction(toDevice(d)),
        }),
      ),
  );

  const navigate = useNavigate();

  const deviceAction = (device: Proposal.Device | Proposal.UnusedSlot) => {
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
    const location = createPartitionableLocation(collection, index);
    if (!location) return;

    setSpacePolicy(location.collection, location.index, { type: "custom", actions });
    navigate("..");
  };

  const description = _(
    "Select what to do with each partition in order to find space for allocating the new system.",
  );

  return (
    <Page
      breadcrumbs={[
        { label: _("Storage"), path: STORAGE.root },
        { label: sprintf(_("Find space in %s"), device.name) },
      ]}
    >
      <Page.Content>
        <SubtleContent>{description}</SubtleContent>
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
