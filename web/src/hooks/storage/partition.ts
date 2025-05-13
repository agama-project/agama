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
import { addPartition, editPartition, deletePartition } from "~/helpers/storage/partition";

type AddPartitionFn = (list: string, listIndex: number | string, data: data.Partition) => void;

function useAddPartition(options?: QueryHookOptions): AddPartitionFn {
  const apiModel = useApiModel(options);
  const updateApiModel = useUpdateApiModel();
  return (list: string, listIndex: number | string, data: data.Partition) => {
    updateApiModel(addPartition(apiModel, list, listIndex, data));
  };
}

type EditPartitionFn = (
  list: string,
  listIndex: number | string,
  mountPath: string,
  data: data.Partition,
) => void;

function useEditPartition(options?: QueryHookOptions): EditPartitionFn {
  const apiModel = useApiModel(options);
  const updateApiModel = useUpdateApiModel();
  return (list: string, listIndex: number | string, mountPath: string, data: data.Partition) => {
    updateApiModel(editPartition(apiModel, list, listIndex, mountPath, data));
  };
}

type DeletePartitionFn = (list: string, listIndex: number | string, mountPath: string) => void;

function useDeletePartition(options?: QueryHookOptions): DeletePartitionFn {
  const apiModel = useApiModel(options);
  const updateApiModel = useUpdateApiModel();
  return (list: string, listIndex: number | string, mountPath: string) =>
    updateApiModel(deletePartition(apiModel, list, listIndex, mountPath));
}

export { useAddPartition, useEditPartition, useDeletePartition };
export type { DeletePartitionFn };
