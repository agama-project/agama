/*
 * Copyright (c) [2024-2025] SUSE LLC
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
import { ActionGroup, Content, Form } from "@patternfly/react-core";
import { useNavigate, useParams } from "react-router";
import { Page } from "~/components/core";
import { SpaceActionsTable } from "~/components/storage";
import { deviceChildren } from "~/components/storage/utils";
import { _ } from "~/i18n";
import { PartitionSlot, SpacePolicyAction, StorageDevice } from "~/types/storage";
import { apiModel } from "~/api/storage/types";
import { useDevices } from "~/queries/storage";
import { useModel } from "~/hooks/storage/model";
import { useSetSpacePolicy } from "~/hooks/storage/space-policy";
import { toStorageDevice } from "./device-utils";
import textStyles from "@patternfly/react-styles/css/utilities/Text/text";
import { sprintf } from "sprintf-js";

const partitionAction = (partition: apiModel.Partition) => {
  if (partition.delete) return "delete";
  if (partition.resizeIfNeeded) return "resizeIfNeeded";

  return undefined;
};

/**
 * Renders a page that allows the user to select the space policy and actions.
 */
export default function SpacePolicySelection() {
  const { list, listIndex } = useParams();
  const model = useModel({ suspense: true });
  const deviceModel = model[list][listIndex];
  const devices = useDevices("system", { suspense: true });
  const device = devices.find((d) => d.name === deviceModel.name);
  const children = deviceChildren(device);
  const setSpacePolicy = useSetSpacePolicy();

  const partitionDeviceAction = (device: StorageDevice) => {
    const partition = deviceModel.partitions?.find((p) => p.name === device.name);

    return partition ? partitionAction(partition) : undefined;
  };

  const [actions, setActions] = useState(
    children
      .filter((d) => toStorageDevice(d) && partitionDeviceAction(toStorageDevice(d)))
      .map(
        (d: StorageDevice): SpacePolicyAction => ({
          deviceName: toStorageDevice(d).name,
          value: partitionDeviceAction(toStorageDevice(d)),
        }),
      ),
  );

  const navigate = useNavigate();

  const deviceAction = (device: StorageDevice | PartitionSlot) => {
    if (toStorageDevice(device) === undefined) return "keep";

    return actions.find((a) => a.deviceName === toStorageDevice(device).name)?.value || "keep";
  };

  const changeActions = (spaceAction: SpacePolicyAction) => {
    const spaceActions = actions.filter((a) => a.deviceName !== spaceAction.deviceName);
    spaceActions.push(spaceAction);

    setActions(spaceActions);
  };

  const onSubmit = (e) => {
    e.preventDefault();
    setSpacePolicy(list, listIndex, { type: "custom", actions });
    navigate("..");
  };

  const description = _(
    "Select what to do with each partition in order to find space for allocating the new system.",
  );

  return (
    <Page>
      <Page.Header>
        <Content component="h2">{sprintf(_("Find space in %s"), device.name)}</Content>
        <p className={textStyles.textColorSubtle}>{description}</p>
      </Page.Header>

      <Page.Content>
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
