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
import ConfigEditorItem from "~/components/storage/ConfigEditorItem";
import PartitionableHeader from "~/components/storage/PartitionableHeader";
import PartitionsMenu from "~/components/storage/PartitionsMenu";
import SpacePolicyMenu from "~/components/storage/SpacePolicyMenu";
import SearchedDeviceMenu from "~/components/storage/SearchedDeviceMenu";
import { model, StorageDevice } from "~/types/storage";
import { MdRaid } from "~/types/storage/model";
import { useDeleteMdRaid } from "~/hooks/storage/md-raid";

type MdRaidDeviceMenuProps = {
  raid: model.MdRaid;
  selected: StorageDevice;
};

/**
 * Internal component that renders generic actions available for an MdRaid device.
 */
const MdRaidDeviceMenu = ({ raid, selected }: MdRaidDeviceMenuProps): React.ReactNode => {
  const deleteMdRaid = useDeleteMdRaid();
  const deleteFn = (device: model.MdRaid) => deleteMdRaid(device.name);

  return <SearchedDeviceMenu modelDevice={raid} selected={selected} deleteFn={deleteFn} />;
};

type MdRaidEditorProps = { raid: MdRaid; raidDevice: StorageDevice };

/**
 * Component responsible for displaying detailed information and available
 * actions related to a specific MdRaid device within the storage ConfigEditor.
 */
export default function MdRaidEditor({ raid, raidDevice }: MdRaidEditorProps) {
  return (
    <ConfigEditorItem
      header={<PartitionableHeader drive={raid} device={raidDevice} />}
      content={
        <>
          <PartitionsMenu device={raid} />
          <SpacePolicyMenu modelDevice={raid} device={raidDevice} />
        </>
      }
      actions={<MdRaidDeviceMenu raid={raid} selected={raidDevice} />}
    />
  );
}
