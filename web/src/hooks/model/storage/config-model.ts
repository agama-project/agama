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

import { useCallback } from "react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useSystem } from "~/hooks/model/system/storage";
import { solveStorageModel, getStorageModel, putStorageModel } from "~/api";
import configModel from "~/model/storage/config-model";
import type { ConfigModel, Data, Partitionable } from "~/model/storage/config-model";

const configModelQuery = {
  queryKey: ["storageModel"],
  queryFn: getStorageModel,
};

function useConfigModel(): ConfigModel.Config | null {
  return useSuspenseQuery(configModelQuery).data;
}

const solvedConfigModelQuery = (config?: ConfigModel.Config) => ({
  queryKey: ["solvedStorageModel", JSON.stringify(config)],
  queryFn: () => (config ? solveStorageModel(config) : Promise.resolve(null)),
  staleTime: Infinity,
});

function useSolvedConfigModel(config?: ConfigModel.Config): ConfigModel.Config | null {
  return useSuspenseQuery(solvedConfigModelQuery(config)).data;
}

function useMissingMountPaths(): string[] {
  const productMountPoints = useSystem()?.productMountPoints;
  const { data } = useSuspenseQuery({
    ...configModelQuery,
    select: useCallback(
      (data: ConfigModel.Config | null): string[] => {
        const currentMountPaths = data ? configModel.usedMountPaths(data) : [];
        return (productMountPoints || []).filter((p) => !currentMountPaths.includes(p));
      },
      [productMountPoints],
    ),
  });
  return data;
}

type SetBootDeviceFn = (deviceName: string) => void;

function useSetBootDevice(): SetBootDeviceFn {
  const config = useConfigModel();
  return (deviceName: string) => putStorageModel(configModel.boot.setDevice(config, deviceName));
}

type SetDefaultBootDeviceFn = () => void;

function useSetDefaultBootDevice(): SetDefaultBootDeviceFn {
  const config = useConfigModel();
  return () => putStorageModel(configModel.boot.setDefault(config));
}

type DisableBootConfigFn = () => void;

function useDisableBoot(): DisableBootConfigFn {
  const config = useConfigModel();
  return () => putStorageModel(configModel.boot.disable(config));
}

function usePartitionable(
  collection: Partitionable.CollectionName,
  index: number,
): Partitionable.Device | null {
  const { data } = useSuspenseQuery({
    ...configModelQuery,
    select: useCallback(
      (data: ConfigModel.Config | null): Partitionable.Device | null =>
        data ? configModel.partitionable.find(data, collection, index) : null,
      [collection, index],
    ),
  });
  return data;
}

function useDrive(index: number): ConfigModel.Drive | null {
  const { data } = useSuspenseQuery({
    ...configModelQuery,
    select: useCallback(
      (data: ConfigModel.Config | null): ConfigModel.Drive | null =>
        data ? configModel.drive.find(data, index) : null,
      [index],
    ),
  });
  return data;
}

type AddDriveFn = (data: Data.Drive) => void;

function useAddDrive(): AddDriveFn {
  const config = useConfigModel();
  return (data: Data.Drive) => {
    putStorageModel(configModel.drive.add(config, data));
  };
}

type DeleteDriveFn = (inex: number) => void;

function useDeleteDrive(): DeleteDriveFn {
  const config = useConfigModel();
  return (index: number) => {
    putStorageModel(configModel.drive.remove(config, index));
  };
}

type AddDriveFromMdRaidFn = (oldName: string, drive: Data.Drive) => void;

function useAddDriveFromMdRaid(): AddDriveFromMdRaidFn {
  const config = useConfigModel();
  return (oldName: string, drive: Data.Drive) => {
    putStorageModel(configModel.drive.addFromMdRaid(config, oldName, drive));
  };
}

function useMdRaid(index: number): ConfigModel.MdRaid | null {
  const { data } = useSuspenseQuery({
    ...configModelQuery,
    select: useCallback(
      (data: ConfigModel.Config | null): ConfigModel.MdRaid | null =>
        data ? configModel.mdRaid.find(data, index) : null,
      [index],
    ),
  });
  return data;
}

type AddReusedMdRaidFn = (data: Data.MdRaid) => void;

function useAddMdRaid(): AddReusedMdRaidFn {
  const config = useConfigModel();
  return (data: Data.MdRaid) => {
    putStorageModel(configModel.mdRaid.add(config, data));
  };
}

type DeleteMdRaidFn = (index: number) => void;

function useDeleteMdRaid(): DeleteMdRaidFn {
  const config = useConfigModel();
  return (index: number) => {
    putStorageModel(configModel.mdRaid.remove(config, index));
  };
}

type AddMdRaidFromDriveFn = (oldName: string, raid: Data.MdRaid) => void;

function useAddMdRaidFromDrive(): AddMdRaidFromDriveFn {
  const config = useConfigModel();
  return (oldName: string, raid: Data.MdRaid) => {
    putStorageModel(configModel.mdRaid.addFromDrive(config, oldName, raid));
  };
}

function useVolumeGroup(vgName: string): ConfigModel.VolumeGroup | null {
  const config = useConfigModel();
  const volumeGroup = config?.volumeGroups?.find((v) => v.vgName === vgName);
  return volumeGroup || null;
}

type AddVolumeGroupFn = (data: Data.VolumeGroup, moveContent: boolean) => void;

function useAddVolumeGroup(): AddVolumeGroupFn {
  const config = useConfigModel();
  return (data: Data.VolumeGroup, moveContent: boolean) => {
    putStorageModel(configModel.volumeGroup.add(config, data, moveContent));
  };
}

type EditVolumeGroupFn = (vgName: string, data: Data.VolumeGroup) => void;

function useEditVolumeGroup(): EditVolumeGroupFn {
  const config = useConfigModel();
  return (vgName: string, data: Data.VolumeGroup) => {
    putStorageModel(configModel.volumeGroup.edit(config, vgName, data));
  };
}

type DeleteVolumeGroupFn = (vgName: string, moveToDrive: boolean) => void;

function useDeleteVolumeGroup(): DeleteVolumeGroupFn {
  const config = useConfigModel();
  return (vgName: string, moveToDrive: boolean) => {
    putStorageModel(
      moveToDrive
        ? configModel.volumeGroup.convertToPartitionable(config, vgName)
        : configModel.volumeGroup.remove(config, vgName),
    );
  };
}

type AddVolumeGroupFromPartitionableFn = (driveName: string) => void;

function useAddVolumeGroupFromPartitionable(): AddVolumeGroupFromPartitionableFn {
  const config = useConfigModel();
  return (driveName: string) => {
    putStorageModel(configModel.volumeGroup.addFromPartitionable(config, driveName));
  };
}

type AddLogicalVolumeFn = (vgName: string, data: Data.LogicalVolume) => void;

function useAddLogicalVolume(): AddLogicalVolumeFn {
  const config = useConfigModel();
  return (vgName: string, data: Data.LogicalVolume) => {
    putStorageModel(configModel.logicalVolume.add(config, vgName, data));
  };
}

type EditLogicalVolumeFn = (vgName: string, mountPath: string, data: Data.LogicalVolume) => void;

function useEditLogicalVolume(): EditLogicalVolumeFn {
  const config = useConfigModel();
  return (vgName: string, mountPath: string, data: Data.LogicalVolume) => {
    putStorageModel(configModel.logicalVolume.edit(config, vgName, mountPath, data));
  };
}

type DeleteLogicalVolumeFn = (vgName: string, mountPath: string) => void;

function useDeleteLogicalVolume(): DeleteLogicalVolumeFn {
  const config = useConfigModel();
  return (vgName: string, mountPath: string) =>
    putStorageModel(configModel.logicalVolume.remove(config, vgName, mountPath));
}

type AddPartitionFn = (
  collection: Partitionable.CollectionName,
  index: number,
  data: Data.Partition,
) => void;

function useAddPartition(): AddPartitionFn {
  const config = useConfigModel();
  return (collection: Partitionable.CollectionName, index: number, data: Data.Partition) => {
    putStorageModel(configModel.partition.add(config, collection, index, data));
  };
}

type EditPartitionFn = (
  collection: Partitionable.CollectionName,
  index: number,
  mountPath: string,
  data: Data.Partition,
) => void;

function useEditPartition(): EditPartitionFn {
  const config = useConfigModel();
  return (
    collection: Partitionable.CollectionName,
    index: number,
    mountPath: string,
    data: Data.Partition,
  ) => {
    putStorageModel(configModel.partition.edit(config, collection, index, mountPath, data));
  };
}

type DeletePartitionFn = (
  collection: Partitionable.CollectionName,
  index: number,
  mountPath: string,
) => void;

function useDeletePartition(): DeletePartitionFn {
  const config = useConfigModel();
  return (collection: Partitionable.CollectionName, index: number, mountPath: string) =>
    putStorageModel(configModel.partition.remove(config, collection, index, mountPath));
}

type SetFilesystemFn = (
  collection: Partitionable.CollectionName,
  index: number,
  data: Data.Formattable,
) => void;

function useSetFilesystem(): SetFilesystemFn {
  const config = useConfigModel();
  return (collection: Partitionable.CollectionName, index: number, data: Data.Formattable) => {
    putStorageModel(configModel.partitionable.setFilesystem(config, collection, index, data));
  };
}

type setSpacePolicyFn = (
  collection: Partitionable.CollectionName,
  index: number,
  data: Data.SpacePolicy,
) => void;

function useSetSpacePolicy(): setSpacePolicyFn {
  const model = useConfigModel();
  return (collection: Partitionable.CollectionName, index: number, data: Data.SpacePolicy) => {
    putStorageModel(configModel.partitionable.setSpacePolicy(model, collection, index, data));
  };
}

export {
  useConfigModel,
  useSolvedConfigModel,
  useMissingMountPaths,
  useSetBootDevice,
  useSetDefaultBootDevice,
  useDisableBoot,
  usePartitionable,
  useDrive,
  useAddDrive,
  useDeleteDrive,
  useAddDriveFromMdRaid,
  useMdRaid,
  useAddMdRaid,
  useDeleteMdRaid,
  useAddMdRaidFromDrive,
  useVolumeGroup,
  useAddVolumeGroup,
  useEditVolumeGroup,
  useDeleteVolumeGroup,
  useAddVolumeGroupFromPartitionable,
  useAddLogicalVolume,
  useEditLogicalVolume,
  useDeleteLogicalVolume,
  useAddPartition,
  useEditPartition,
  useDeletePartition,
  useSetFilesystem,
  useSetSpacePolicy,
};
