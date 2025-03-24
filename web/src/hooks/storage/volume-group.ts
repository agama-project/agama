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

import { useApiModel, useUpdateApiModel } from "~/hooks/storage/api-model";
import { addVolumeGroup, editVolumeGroup, deleteVolumeGroup } from "~/helpers/storage/volume-group";
import { QueryHookOptions } from "~/types/queries";
import { model } from "~/types/storage";
import { useModel } from "~/hooks/storage/model";

function useVolumeGroup(vgName: string, options?: QueryHookOptions): model.VolumeGroup | null {
  const model = useModel(options);
  const volumeGroup = model?.volumeGroups?.find((v) => v.vgName === vgName);
  return volumeGroup || null;
}

type AddVolumeGroupFn = (vgName: string, targetDevices: string[], moveContent: boolean) => void;

function useAddVolumeGroup(options?: QueryHookOptions): AddVolumeGroupFn {
  const apiModel = useApiModel(options);
  const updateApiModel = useUpdateApiModel();
  return (vgName: string, targetDevices: string[], moveContent: boolean) => {
    updateApiModel(addVolumeGroup(apiModel, vgName, targetDevices, moveContent));
  };
}

type EditVolumeGroupFn = (odlVgName: string, VgName: string, targetDevices: string[]) => void;

function useEditVolumeGroup(options?: QueryHookOptions): EditVolumeGroupFn {
  const apiModel = useApiModel(options);
  const updateApiModel = useUpdateApiModel();
  return (oldVgName: string, vgName: string, targetDevices: string[]) => {
    updateApiModel(editVolumeGroup(apiModel, oldVgName, vgName, targetDevices));
  };
}

type DeleteVolumeGroupFn = (vgName: string) => void;

function useDeleteVolumeGroup(options?: QueryHookOptions): DeleteVolumeGroupFn {
  const apiModel = useApiModel(options);
  const updateApiModel = useUpdateApiModel();
  return (vgName: string) => updateApiModel(deleteVolumeGroup(apiModel, vgName));
}

export { useVolumeGroup, useAddVolumeGroup, useEditVolumeGroup, useDeleteVolumeGroup };
export type { AddVolumeGroupFn, EditVolumeGroupFn, DeleteVolumeGroupFn };
