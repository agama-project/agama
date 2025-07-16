/*
 * Copyright (c) [2025] SUSE LLC
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
import { Stack, Flex, StackItem } from "@patternfly/react-core";
import { generatePath } from "react-router-dom";
import Link from "~/components/core/Link";
import { STORAGE as PATHS } from "~/routes/paths";
import FilesystemMenu from "~/components/storage/FilesystemMenu";
import PartitionsMenu from "~/components/storage/PartitionsMenu";
import SpacePolicyMenu from "~/components/storage/SpacePolicyMenu";
import { model, StorageDevice } from "~/types/storage";
import { _ } from "~/i18n";

type DeviceEmptyStateProps = Pick<DeviceEditorContentProps, "deviceModel">;

function DeviceEmptyState({ deviceModel }: DeviceEmptyStateProps): React.ReactNode {
  const { list, listIndex } = deviceModel;
  const newPartitionPath = generatePath(PATHS.addPartition, { list, listIndex });
  const formatDevicePath = generatePath(PATHS.formatDevice, { list, listIndex });

  return (
    <Flex gap={{ default: "gapXs" }}>
      <Stack>
        <StackItem>
          <Link variant="link" isInline to={newPartitionPath}>
            {_("Add a new partition or mount an existing one")}
          </Link>
        </StackItem>
        <StackItem>
          <Link variant="link" isInline to={formatDevicePath}>
            {_("Mount the device")}
          </Link>
        </StackItem>
      </Stack>
    </Flex>
  );
}

type DeviceEditorContentProps = { deviceModel: model.Drive | model.MdRaid; device: StorageDevice };

export default function DeviceEditorContent({
  deviceModel,
  device,
}: DeviceEditorContentProps): React.ReactNode {
  if (!deviceModel.isUsed) return <DeviceEmptyState deviceModel={deviceModel} />;

  return (
    <>
      {deviceModel.filesystem && <FilesystemMenu deviceModel={deviceModel} />}
      {!deviceModel.filesystem && <PartitionsMenu device={deviceModel} />}
      {!deviceModel.filesystem && <SpacePolicyMenu modelDevice={deviceModel} device={device} />}
    </>
  );
}
