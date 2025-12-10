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
import { addLogicalVolume, editLogicalVolume, deleteLogicalVolume } from "~/storage/logical-volume";
import type { data } from "~/storage";

type AddLogicalVolumeFn = (vgName: string, data: data.LogicalVolume) => void;

function useAddLogicalVolume(): AddLogicalVolumeFn {
  const apiModel = useConfigModel();
  return (vgName: string, data: data.LogicalVolume) => {
    putStorageModel(addLogicalVolume(apiModel, vgName, data));
  };
}

type EditLogicalVolumeFn = (vgName: string, mountPath: string, data: data.LogicalVolume) => void;

function useEditLogicalVolume(): EditLogicalVolumeFn {
  const apiModel = useConfigModel();
  return (vgName: string, mountPath: string, data: data.LogicalVolume) => {
    putStorageModel(editLogicalVolume(apiModel, vgName, mountPath, data));
  };
}

type DeleteLogicalVolumeFn = (vgName: string, mountPath: string) => void;

function useDeleteLogicalVolume(): DeleteLogicalVolumeFn {
  const apiModel = useConfigModel();
  return (vgName: string, mountPath: string) =>
    putStorageModel(deleteLogicalVolume(apiModel, vgName, mountPath));
}

export { useAddLogicalVolume, useEditLogicalVolume, useDeleteLogicalVolume };
export type { DeleteLogicalVolumeFn };
