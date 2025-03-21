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
import { QueryHookOptions } from "~/types/queries";
import { deleteVolumeGroup } from "~/hooks/storage/helpers/volume-group";

export type DeleteVolumeGroupFn = (vgName: string) => void;

export default function useDeleteVolumeGroup(options?: QueryHookOptions): DeleteVolumeGroupFn {
  const apiModel = useApiModel(options);
  const updateApiModel = useUpdateApiModel();
  return (vgName: string) => updateApiModel(deleteVolumeGroup(apiModel, vgName));
}
