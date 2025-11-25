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

import { useStorageModel } from "~/hooks/api/storage";
import { putStorageModel } from "~/api";
import {
  addVolumeGroup,
  editVolumeGroup,
  deleteVolumeGroup,
  volumeGroupToPartitions,
  deviceToVolumeGroup,
} from "~/storage/volume-group";
import { model, data } from "~/storage";
import { useModel } from "~/hooks/storage/model";

function useVolumeGroup(vgName: string): model.VolumeGroup | null {
  const model = useModel();
  const volumeGroup = model?.volumeGroups?.find((v) => v.vgName === vgName);
  return volumeGroup || null;
}

type AddVolumeGroupFn = (data: data.VolumeGroup, moveContent: boolean) => void;

function useAddVolumeGroup(): AddVolumeGroupFn {
  const apiModel = useStorageModel();
  return (data: data.VolumeGroup, moveContent: boolean) => {
    putStorageModel(addVolumeGroup(apiModel, data, moveContent));
  };
}

type EditVolumeGroupFn = (vgName: string, data: data.VolumeGroup) => void;

function useEditVolumeGroup(): EditVolumeGroupFn {
  const apiModel = useStorageModel();
  return (vgName: string, data: data.VolumeGroup) => {
    putStorageModel(editVolumeGroup(apiModel, vgName, data));
  };
}

type DeleteVolumeGroupFn = (vgName: string, moveToDrive: boolean) => void;

function useDeleteVolumeGroup(): DeleteVolumeGroupFn {
  const apiModel = useStorageModel();
  return (vgName: string, moveToDrive: boolean) => {
    putStorageModel(
      moveToDrive ? volumeGroupToPartitions(apiModel, vgName) : deleteVolumeGroup(apiModel, vgName),
    );
  };
}

type ConvertToVolumeGroupFn = (driveName: string) => void;

function useConvertToVolumeGroup(): ConvertToVolumeGroupFn {
  const apiModel = useStorageModel();
  return (driveName: string) => {
    putStorageModel(deviceToVolumeGroup(apiModel, driveName));
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
