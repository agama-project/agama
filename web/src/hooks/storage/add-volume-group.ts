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
import { apiModel } from "~/api/storage/types";

function toLogicalVolume(partition: apiModel.Partition) {
  return { ...partition };
}

function movePartitions(drive: apiModel.Drive, volumeGroup: apiModel.VolumeGroup) {
  if (!drive.partitions) return;

  const newPartitions = drive.partitions.filter((p) => !p.name);
  const reusedPartitions = drive.partitions.filter((p) => p.name);
  drive.partitions = [...reusedPartitions];
  const logicalVolumes = volumeGroup.logicalVolumes || [];
  volumeGroup.logicalVolumes = [...logicalVolumes, ...newPartitions.map(toLogicalVolume)];
}

function addVolumeGroup(
  apiModel: apiModel.Config,
  vgName: string,
  targetDevices: string[],
  moveContent: boolean,
): apiModel.Config {
  const volumeGroup = { vgName, targetDevices };
  if (moveContent) {
    (apiModel.drives || [])
      .filter((d) => targetDevices.includes(d.name))
      .forEach((d) => movePartitions(d, volumeGroup));
  }
  apiModel.volumeGroups ||= [];
  apiModel.volumeGroups.push(volumeGroup);
  return apiModel;
}

type AddVolumeGroupFn = (vgName: string, targetDevices: string[], moveContent: boolean) => void;

function useAddVolumeGroup(options?: QueryHookOptions): AddVolumeGroupFn {
  const apiModel = useApiModel(options);
  const updateApiModel = useUpdateApiModel();
  return (vgName: string, targetDevices: string[], moveContent: boolean) => {
    updateApiModel(addVolumeGroup(apiModel, vgName, targetDevices, moveContent));
  };
}

export { useAddVolumeGroup as default };
export type { AddVolumeGroupFn };
