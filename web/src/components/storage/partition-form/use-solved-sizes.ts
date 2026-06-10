/*
 * Copyright (c) [2026] SUSE LLC
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

import { useParams } from "react-router";
import {
  useConfigModel,
  usePartitionable,
  useSolvedConfigModel,
} from "~/hooks/model/storage/config-model";
import configModel from "~/model/storage/config-model";
import {
  deviceSize,
  createPartitionableLocation,
  findPartitionableDevice,
} from "~/components/storage/utils";
import { FILESYSTEM_TYPE } from "./fields";
import type { SolvedSizes } from "~/components/storage/shared/SizeFields";
import type { ConfigModel } from "~/model/storage/config-model";

/**
 * Builds a model in which the size of the relevant partition is omitted, to be
 * used by useSolvedConfigModel.
 */
function useSparseModel(mountPoint: string, filesystem: string): ConfigModel.Config {
  const { collection, index } = useParams();
  const model = useConfigModel();

  const partitionConfig: ConfigModel.Partition = {
    mountPath: mountPoint,
    name: undefined, // Always treat as new partition for size calculation
    filesystem:
      filesystem === FILESYSTEM_TYPE.AUTO
        ? undefined
        : {
            default: false,
            type: filesystem as ConfigModel.FilesystemType,
            label: undefined,
          },
    size: undefined, // Force automatic sizing
  };

  const location = createPartitionableLocation(collection, index);
  const device = usePartitionable(location.collection, location.index);
  const initialPartitionCfg = configModel.partitionable.findPartition(device, mountPoint);
  const idx = location.index;

  return initialPartitionCfg
    ? configModel.partition.edit(model, location.collection, idx, mountPoint, partitionConfig)
    : configModel.partition.add(model, location.collection, idx, partitionConfig);
}

/**
 * Calculates the solved sizes for a partition configuration.
 *
 * Called during render when committedMountPoint or filesystem change. Provided
 * to the shared SizeFields component, which is size-solving agnostic.
 *
 * @returns Object with min and max size strings, or null if sizes cannot be
 *   calculated.
 */
export function useSolvedSizes(mountPoint: string, filesystem: string): SolvedSizes {
  const { collection, index } = useParams();

  const sparseModel = useSparseModel(mountPoint, filesystem);
  const solvedModel = useSolvedConfigModel(sparseModel);

  if (!solvedModel) return null;

  const solvedDevice = findPartitionableDevice(solvedModel, collection, index);
  const solvedPartition = solvedDevice?.partitions?.find((p) => p.mountPath === mountPoint);

  if (!solvedPartition?.size) return null;

  return {
    min: solvedPartition.size.min ? deviceSize(solvedPartition.size.min) : undefined,
    max: solvedPartition.size.max ? deviceSize(solvedPartition.size.max) : undefined,
  };
}
