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
import { useConfigModel, useSolvedConfigModel } from "~/hooks/model/storage/config-model";
import configModel from "~/model/storage/config-model";
import { deviceSize } from "~/components/storage/utils";
import { FILESYSTEM_TYPE } from "./fields";
import { useVolumeGroupConfig, useInitialLogicalVolumeConfig } from "./data";
import type { SolvedSizes } from "~/components/storage/shared/SizeFields";
import type { ConfigModel } from "~/model/storage/config-model";

/**
 * Builds a model in which the size of the relevant logical volume is omitted, to
 * be used by useSolvedConfigModel. The label and name are also stripped so the
 * solved model is not recalculated when only those change.
 */
function useSparseModel(mountPoint: string, filesystem: string): ConfigModel.Config | undefined {
  const { id } = useParams();
  const index = Number(id);
  const config = useConfigModel();
  const volumeGroupConfig = useVolumeGroupConfig();
  const initialLogicalVolumeConfig = useInitialLogicalVolumeConfig();

  if (!config || !volumeGroupConfig) return undefined;
  // Sizes are only solved for a new logical volume with a chosen filesystem.
  if (mountPoint === "" || filesystem === "" || filesystem === FILESYSTEM_TYPE.AUTO) {
    return undefined;
  }

  const logicalVolumeConfig: ConfigModel.LogicalVolume = {
    mountPath: mountPoint,
    name: undefined, // Always treat as new logical volume for size calculation
    lvName: undefined,
    filesystem: {
      default: false,
      type: filesystem as ConfigModel.FilesystemType,
      label: undefined,
    },
    size: undefined, // Force automatic sizing
  };

  return initialLogicalVolumeConfig
    ? configModel.logicalVolume.edit(
        config,
        index,
        initialLogicalVolumeConfig.mountPath,
        logicalVolumeConfig,
      )
    : configModel.logicalVolume.add(config, index, logicalVolumeConfig);
}

/**
 * Calculates the solved sizes for a new logical volume.
 *
 * Provided to the shared SizeFields component, which is size-solving agnostic.
 *
 * @returns Object with min and max size strings, or null if sizes cannot be
 *   calculated.
 */
export function useSolvedSizes(mountPoint: string, filesystem: string): SolvedSizes {
  const volumeGroupConfig = useVolumeGroupConfig();
  const sparseModel = useSparseModel(mountPoint, filesystem);
  const solvedModel = useSolvedConfigModel(sparseModel);

  if (!solvedModel || !volumeGroupConfig) return null;

  const solvedVolumeGroupConfig = configModel.volumeGroup.findByName(
    solvedModel,
    volumeGroupConfig.vgName,
  );
  const solvedLogicalVolume = configModel.device.findVolumeByMountPath(
    solvedVolumeGroupConfig,
    mountPoint,
  );

  const size = solvedLogicalVolume?.size;
  if (!size) return null;

  return {
    min: size.min ? deviceSize(size.min) : undefined,
    max: size.max ? deviceSize(size.max) : undefined,
  };
}
