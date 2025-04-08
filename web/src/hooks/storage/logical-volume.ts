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
import { QueryHookOptions } from "~/types/queries";
import { data } from "~/types/storage";
import {
  addLogicalVolume,
  editLogicalVolume,
  deleteLogicalVolume,
} from "~/helpers/storage/logical-volume";

type AddLogicalVolumeFn = (vgName: string, data: data.LogicalVolume) => void;

function useAddLogicalVolume(options?: QueryHookOptions): AddLogicalVolumeFn {
  const apiModel = useApiModel(options);
  const updateApiModel = useUpdateApiModel();
  return (vgName: string, data: data.LogicalVolume) => {
    updateApiModel(addLogicalVolume(apiModel, vgName, data));
  };
}

type EditLogicalVolumeFn = (vgName: string, mountPath: string, data: data.LogicalVolume) => void;

function useEditLogicalVolume(options?: QueryHookOptions): EditLogicalVolumeFn {
  const apiModel = useApiModel(options);
  const updateApiModel = useUpdateApiModel();
  return (vgName: string, mountPath: string, data: data.LogicalVolume) => {
    updateApiModel(editLogicalVolume(apiModel, vgName, mountPath, data));
  };
}

type DeleteLogicalVolumeFn = (vgName: string, mountPath: string) => void;

function useDeleteLogicalVolume(options?: QueryHookOptions): DeleteLogicalVolumeFn {
  const apiModel = useApiModel(options);
  const updateApiModel = useUpdateApiModel();
  return (vgName: string, mountPath: string) =>
    updateApiModel(deleteLogicalVolume(apiModel, vgName, mountPath));
}

export { useAddLogicalVolume, useEditLogicalVolume, useDeleteLogicalVolume };
export type { DeleteLogicalVolumeFn };
