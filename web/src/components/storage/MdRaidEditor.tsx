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
import { MdRaid } from "~/types/storage/model";
import { StorageDevice } from "~/types/storage";
import PartitionableHeader from "~/components/storage/PartitionableHeader";
import PartitionsMenu from "~/components/storage/PartitionsMenu";
import MdRaidDeviceMenu from "~/components/storage/MdRaidDeviceMenu";
import SpacePolicyMenu from "~/components/storage/SpacePolicyMenu";
import { Card, CardBody, CardHeader, CardTitle, Flex } from "@patternfly/react-core";

import spacingStyles from "@patternfly/react-styles/css/utilities/Spacing/spacing";

export type MdRaidEditorProps = { raid: MdRaid; raidDevice: StorageDevice };

const MdRaidHeader = ({ raid, raidDevice }: MdRaidEditorProps) => {
  return (
    <PartitionableHeader device={raid}>
      <MdRaidDeviceMenu raid={raid} selected={raidDevice} />
    </PartitionableHeader>
  );
};

export default function MdRaidEditor({ raid, raidDevice }: MdRaidEditorProps) {
  return (
    <Card isCompact>
      <CardHeader>
        <CardTitle>
          <MdRaidHeader raid={raid} raidDevice={raidDevice} />
        </CardTitle>
      </CardHeader>
      <CardBody className={spacingStyles.plLg}>
        <Flex direction={{ default: "column" }}>
          <SpacePolicyMenu modelDevice={raid} device={raidDevice} />
          <PartitionsMenu device={raid} />
        </Flex>
      </CardBody>
    </Card>
  );
}
