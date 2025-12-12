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

import { useConfigModel } from "~/hooks/model/storage";
import { putStorageModel } from "~/api";
import {
  addVolumeGroup,
  editVolumeGroup,
  deleteVolumeGroup,
  volumeGroupToPartitions,
  deviceToVolumeGroup,
} from "~/storage/volume-group";
import { useModel } from "~/hooks/storage/model";
import type { ConfigModel, Data } from "~/model/storage/config-model";

function useVolumeGroup(vgName: string): ConfigModel.VolumeGroup | null {
  const model = useModel();
  const volumeGroup = model?.volumeGroups?.find((v) => v.vgName === vgName);
  return volumeGroup || null;
}

type AddVolumeGroupFn = (data: Data.VolumeGroup, moveContent: boolean) => void;

function useAddVolumeGroup(): AddVolumeGroupFn {
  const config = useConfigModel();
  return (data: Data.VolumeGroup, moveContent: boolean) => {
    putStorageModel(addVolumeGroup(config, data, moveContent));
  };
}

type EditVolumeGroupFn = (vgName: string, data: Data.VolumeGroup) => void;

function useEditVolumeGroup(): EditVolumeGroupFn {
  const config = useConfigModel();
  return (vgName: string, data: Data.VolumeGroup) => {
    putStorageModel(editVolumeGroup(config, vgName, data));
  };
}

type DeleteVolumeGroupFn = (vgName: string, moveToDrive: boolean) => void;

function useDeleteVolumeGroup(): DeleteVolumeGroupFn {
  const config = useConfigModel();
  return (vgName: string, moveToDrive: boolean) => {
    putStorageModel(
      moveToDrive ? volumeGroupToPartitions(config, vgName) : deleteVolumeGroup(config, vgName),
    );
  };
}

type ConvertToVolumeGroupFn = (driveName: string) => void;

function useConvertToVolumeGroup(): ConvertToVolumeGroupFn {
  const config = useConfigModel();
  return (driveName: string) => {
    putStorageModel(deviceToVolumeGroup(config, driveName));
  };
}

export {
  useVolumeGroup,
  useAddVolumeGroup,
  useEditVolumeGroup,
  useDeleteVolumeGroup,
  useConvertToVolumeGroup,
};
export type { AddVolumeGroupFn, EditVolumeGroupFn, DeleteVolumeGroupFn, ConvertToVolumeGroupFn };
