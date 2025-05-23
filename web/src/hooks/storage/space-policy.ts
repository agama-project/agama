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
import { setSpacePolicy } from "~/helpers/storage/space-policy";

type setSpacePolicyFn = (list: string, listIndex: number | string, data: data.SpacePolicy) => void;

function useSetSpacePolicy(options?: QueryHookOptions): setSpacePolicyFn {
  const apiModel = useApiModel(options);
  const updateApiModel = useUpdateApiModel();
  return (list: string, listIndex: number | string, data: data.SpacePolicy) => {
    updateApiModel(setSpacePolicy(apiModel, list, listIndex, data));
  };
}

export { useSetSpacePolicy };
