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
import {
  DataListAction,
  DataListCell,
  DataListItemCells,
  DataListItemRow,
  Flex,
} from "@patternfly/react-core";
import NestedContent from "~/components/core/NestedContent";
import PartitionableHeader from "~/components/storage/PartitionableHeader";
import PartitionsMenu from "~/components/storage/PartitionsMenu";
import MdRaidDeviceMenu from "~/components/storage/MdRaidDeviceMenu";
import SpacePolicyMenu from "~/components/storage/SpacePolicyMenu";
import { MdRaid } from "~/types/storage/model";
import { StorageDevice } from "~/types/storage";
import { deviceLabel } from "./utils";

export type MdRaidEditorProps = { raid: MdRaid; raidDevice: StorageDevice };

export default function MdRaidEditor({ raid, raidDevice }: MdRaidEditorProps) {
  return (
    <DataListItemRow>
      <DataListItemCells
        dataListCells={[
          <DataListCell key="content" isFilled={false}>
            <Flex direction={{ default: "column" }}>
              <PartitionableHeader device={raid}>{deviceLabel(raidDevice)}</PartitionableHeader>
              <NestedContent>
                <PartitionsMenu device={raid} />
                <SpacePolicyMenu modelDevice={raid} device={raidDevice} />
              </NestedContent>
            </Flex>
          </DataListCell>,
        ]}
      />
      {/** @ts-expect-error: props required but not used, see https://github.com/patternfly/patternfly-react/issues/9823 **/}
      <DataListAction>
        <MdRaidDeviceMenu raid={raid} selected={raidDevice} />
      </DataListAction>
    </DataListItemRow>
  );
}
