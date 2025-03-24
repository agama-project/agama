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

import { useQuery, useSuspenseQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiModel } from "~/api/storage/types";
import { configModelQuery } from "~/queries/storage/config-model";
import { QueryHookOptions } from "~/types/queries";
import { setConfigModel } from "~/api/storage";

function useApiModel(options?: QueryHookOptions): apiModel.Config | null {
  const query = configModelQuery;
  const func = options?.suspense ? useSuspenseQuery : useQuery;
  const { data } = func(query);
  return data || null;
}

type UpdateApiModelFn = (apiModel: apiModel.Config) => void;

function useUpdateApiModel(): UpdateApiModelFn {
  const queryClient = useQueryClient();
  const query = {
    mutationFn: (apiModel: apiModel.Config) => setConfigModel(apiModel),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["storage"] }),
  };

  const { mutate } = useMutation(query);
  return mutate;
}

export { useApiModel, useUpdateApiModel };
export type { UpdateApiModelFn };
