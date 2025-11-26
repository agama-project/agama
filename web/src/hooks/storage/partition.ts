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
import { data } from "~/storage";
import { addPartition, editPartition, deletePartition } from "~/storage/partition";

type AddPartitionFn = (
  list: "drives" | "mdRaids",
  listIndex: number | string,
  data: data.Partition,
) => void;

function useAddPartition(): AddPartitionFn {
  const apiModel = useStorageModel();
  return (list: "drives" | "mdRaids", listIndex: number | string, data: data.Partition) => {
    putStorageModel(addPartition(apiModel, list, listIndex, data));
  };
}

type EditPartitionFn = (
  list: "drives" | "mdRaids",
  listIndex: number | string,
  mountPath: string,
  data: data.Partition,
) => void;

function useEditPartition(): EditPartitionFn {
  const apiModel = useStorageModel();
  return (
    list: "drives" | "mdRaids",
    listIndex: number | string,
    mountPath: string,
    data: data.Partition,
  ) => {
    putStorageModel(editPartition(apiModel, list, listIndex, mountPath, data));
  };
}

type DeletePartitionFn = (
  list: "drives" | "mdRaids",
  listIndex: number | string,
  mountPath: string,
) => void;

function useDeletePartition(): DeletePartitionFn {
  const apiModel = useStorageModel();
  return (list: "drives" | "mdRaids", listIndex: number | string, mountPath: string) =>
    putStorageModel(deletePartition(apiModel, list, listIndex, mountPath));
}

export { useAddPartition, useEditPartition, useDeletePartition };
export type { DeletePartitionFn };
