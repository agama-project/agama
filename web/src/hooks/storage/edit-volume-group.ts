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

import useApiModel from "~/hooks/storage/api-model";
import useUpdateApiModel from "~/hooks/storage/update-api-model";
import { addVolumeGroup } from "~/hooks/storage/helpers/volume-group";
import { deleteIfUnused } from "~/hooks/storage/helpers/drive";
import { QueryHookOptions } from "~/types/queries";
import { apiModel } from "~/api/storage/types";

function editVolumeGroup(
  apiModel: apiModel.Config,
  oldVgName: string,
  vgName: string,
  targetDevices: string[],
): apiModel.Config {
  const index = (apiModel.volumeGroups || []).findIndex((v) => v.vgName === oldVgName);
  if (index === -1) return;

  const oldTargetDevices = apiModel.volumeGroups[index].targetDevices || [];

  addVolumeGroup(apiModel, vgName, targetDevices, false, index);
  oldTargetDevices.forEach((d) => deleteIfUnused(apiModel, d));

  return apiModel;
}

export type EditVolumeGroupFn = (
  odlVgName: string,
  VgName: string,
  targetDevices: string[],
) => void;

export default function useEditVolumeGroup(options?: QueryHookOptions): EditVolumeGroupFn {
  const apiModel = useApiModel(options);
  const updateApiModel = useUpdateApiModel();
  return (oldVgName: string, vgName: string, targetDevices: string[]) => {
    updateApiModel(editVolumeGroup(apiModel, oldVgName, vgName, targetDevices));
  };
}
