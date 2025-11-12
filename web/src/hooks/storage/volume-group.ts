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

import { useStorageModel } from "~/hooks/api";
import { putStorageModel } from "~/api";
import {
  addVolumeGroup,
  editVolumeGroup,
  deleteVolumeGroup,
  volumeGroupToPartitions,
  deviceToVolumeGroup,
} from "~/helpers/storage/volume-group";
import { QueryHookOptions } from "~/types/queries";
import { model, data } from "~/types/storage";
import { useModel } from "~/hooks/storage/model";

function useVolumeGroup(vgName: string, options?: QueryHookOptions): model.VolumeGroup | null {
  const model = useModel(options);
  const volumeGroup = model?.volumeGroups?.find((v) => v.vgName === vgName);
  return volumeGroup || null;
}

type AddVolumeGroupFn = (data: data.VolumeGroup, moveContent: boolean) => void;

function useAddVolumeGroup(options?: QueryHookOptions): AddVolumeGroupFn {
  const apiModel = useStorageModel(options);
  return (data: data.VolumeGroup, moveContent: boolean) => {
    putStorageModel(addVolumeGroup(apiModel, data, moveContent));
  };
}

type EditVolumeGroupFn = (vgName: string, data: data.VolumeGroup) => void;

function useEditVolumeGroup(options?: QueryHookOptions): EditVolumeGroupFn {
  const apiModel = useStorageModel(options);
  return (vgName: string, data: data.VolumeGroup) => {
    putStorageModel(editVolumeGroup(apiModel, vgName, data));
  };
}

type DeleteVolumeGroupFn = (vgName: string, moveToDrive: boolean) => void;

function useDeleteVolumeGroup(options?: QueryHookOptions): DeleteVolumeGroupFn {
  const apiModel = useStorageModel(options);
  return (vgName: string, moveToDrive: boolean) => {
    putStorageModel(
      moveToDrive ? volumeGroupToPartitions(apiModel, vgName) : deleteVolumeGroup(apiModel, vgName),
    );
  };
}

type ConvertToVolumeGroupFn = (driveName: string) => void;

function useConvertToVolumeGroup(options?: QueryHookOptions): ConvertToVolumeGroupFn {
  const apiModel = useStorageModel(options);
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
