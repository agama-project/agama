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
import ConfigEditorItem from "~/components/storage/ConfigEditorItem";
import DriveHeader from "~/components/storage/DriveHeader";
import DeviceEditorContent from "~/components/storage/DeviceEditorContent";
import SearchedDeviceMenu from "~/components/storage/SearchedDeviceMenu";
import { model } from "~/types/storage";
import { storage } from "~/api/system";
import { useDeleteDrive } from "~/hooks/storage/drive";

type DriveDeviceMenuProps = {
  drive: model.Drive;
  selected: storage.Device;
};

/**
 * Internal component that renders generic actions available for a Drive device.
 */
const DriveDeviceMenu = ({ drive, selected }: DriveDeviceMenuProps) => {
  const deleteDrive = useDeleteDrive();
  const deleteFn = (device: model.Drive) => deleteDrive(device.name);

  return <SearchedDeviceMenu modelDevice={drive} selected={selected} deleteFn={deleteFn} />;
};

export type DriveEditorProps = { drive: model.Drive; driveDevice: storage.Device };

/**
 * Component responsible for displaying detailed information and available actions
 * related to a specific Drive device within the storage ConfigEditor.
 */
export default function DriveEditor({ drive, driveDevice }: DriveEditorProps) {
  return (
    <ConfigEditorItem
      header={<DriveHeader drive={drive} device={driveDevice} />}
      content={<DeviceEditorContent deviceModel={drive} device={driveDevice} />}
      actions={<DriveDeviceMenu drive={drive} selected={driveDevice} />}
    />
  );
}
