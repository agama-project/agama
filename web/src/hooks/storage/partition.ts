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
import { addPartition, editPartition, deletePartition } from "~/storage/partition";
import type { Data, PartitionableCollection } from "~/model/storage/config-model";

type AddPartitionFn = (
  collection: PartitionableCollection,
  index: number,
  data: Data.Partition,
) => void;

function useAddPartition(): AddPartitionFn {
  const config = useConfigModel();
  return (collection: PartitionableCollection, index: number, data: Data.Partition) => {
    putStorageModel(addPartition(config, collection, index, data));
  };
}

type EditPartitionFn = (
  collection: PartitionableCollection,
  index: number,
  mountPath: string,
  data: Data.Partition,
) => void;

function useEditPartition(): EditPartitionFn {
  const config = useConfigModel();
  return (
    collection: PartitionableCollection,
    index: number,
    mountPath: string,
    data: Data.Partition,
  ) => {
    putStorageModel(editPartition(config, collection, index, mountPath, data));
  };
}

type DeletePartitionFn = (
  collection: PartitionableCollection,
  index: number,
  mountPath: string,
) => void;

function useDeletePartition(): DeletePartitionFn {
  const config = useConfigModel();
  return (collection: PartitionableCollection, index: number, mountPath: string) =>
    putStorageModel(deletePartition(config, collection, index, mountPath));
}

export { useAddPartition, useEditPartition, useDeletePartition };
export type { DeletePartitionFn };
