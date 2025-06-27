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

import React from "react";
import { Drive } from "~/types/storage/model";
import { StorageDevice } from "~/types/storage";
import DriveDeviceMenu from "~/components/storage/DriveDeviceMenu";
import PartitionableHeader from "~/components/storage/PartitionableHeader";
import PartitionsMenu from "~/components/storage/PartitionsMenu";
import SpacePolicyMenu from "~/components/storage/SpacePolicyMenu";
import { Card, CardBody, CardHeader, CardTitle, Flex } from "@patternfly/react-core";
import spacingStyles from "@patternfly/react-styles/css/utilities/Spacing/spacing";
import { deviceLabel } from "./utils";

export type DriveEditorProps = { drive: Drive; driveDevice: StorageDevice };

const DriveHeader = ({ drive, driveDevice }: DriveEditorProps) => {
  return <PartitionableHeader device={drive}>{deviceLabel(driveDevice)}</PartitionableHeader>;
};

export default function DriveEditor({ drive, driveDevice }: DriveEditorProps) {
  return (
    <Card isCompact>
      <CardHeader
        actions={{
          actions: <DriveDeviceMenu drive={drive} selected={driveDevice} />,
        }}
      >
        <CardTitle>
          <DriveHeader drive={drive} driveDevice={driveDevice} />{" "}
        </CardTitle>
      </CardHeader>
      <CardBody className={spacingStyles.plLg}>
        <Flex direction={{ default: "column" }}>
          <SpacePolicyMenu modelDevice={drive} device={driveDevice} />
          <PartitionsMenu device={drive} />
        </Flex>
      </CardBody>
    </Card>
  );
}
