/*
 * Copyright (c) [2025-2026] SUSE LLC
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
import { useSystem as useBootloaderSystem } from "~/hooks/model/system/bootloader";
import { solveStorageModel, getStorageModel, putStorageModel } from "~/api";
import configModel from "~/model/storage/config-model";
import bootloaderSystem from "~/model/system/bootloader";
import { findDeviceByName } from "~/model/system/storage";
import { isNullish } from "radashi";
import type {
  ConfigModel,
  Data,
  Partitionable,
  Device,
  DeviceCollection,
} from "~/model/storage/config-model";

const STORAGE_MODEL_KEY = "storageModel" as const;

const configModelQuery = {
  queryKey: [STORAGE_MODEL_KEY],
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

function useDevice(collection: DeviceCollection, index: number): Device | null {
  const { data } = useSuspenseQuery({
    ...configModelQuery,
    select: useCallback(
      (data: ConfigModel.Config | null): Device | null =>
        data ? configModel.findDevice(data, collection, index) : null,
      [collection, index],
    ),
  });
  return data;
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

type ConvertPartitionableToVolumeGroupFn = (name: string, volumeGroupName?: string) => void;

function useConvertPartitionableToVolumeGroup(): ConvertPartitionableToVolumeGroupFn {
  const config = useConfigModel();
  return (name: string, volumeGroupName?: string) => {
    putStorageModel(configModel.partitionable.convertToVolumeGroup(config, name, volumeGroupName));
  };
}

function useVolumeGroup(index: number): ConfigModel.VolumeGroup | null {
  const { data } = useSuspenseQuery({
    ...configModelQuery,
    select: useCallback(
      (data: ConfigModel.Config | null): ConfigModel.VolumeGroup | null =>
        data ? configModel.volumeGroup.find(data, index) : null,
      [index],
    ),
  });
  return data;
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

type AddLogicalVolumeFn = (vgIndex: number, data: Data.LogicalVolume) => void;

function useAddLogicalVolume(): AddLogicalVolumeFn {
  const config = useConfigModel();
  return (vgIndex: number, data: Data.LogicalVolume) => {
    putStorageModel(configModel.logicalVolume.add(config, vgIndex, data));
  };
}

type EditLogicalVolumeFn = (vgIndex: number, mountPath: string, data: Data.LogicalVolume) => void;

function useEditLogicalVolume(): EditLogicalVolumeFn {
  const config = useConfigModel();
  return (vgIndex: number, mountPath: string, data: Data.LogicalVolume) => {
    putStorageModel(configModel.logicalVolume.edit(config, vgIndex, mountPath, data));
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

type SetEncryptionFn = (encryption?: ConfigModel.Encryption) => void;

function useSetEncryption(): SetEncryptionFn {
  const config = useConfigModel();
  return (encryption?: ConfigModel.Encryption) =>
    putStorageModel(configModel.setEncryption(config, encryption));
}

function useSetFilesystem(): SetFilesystemFn {
  const config = useConfigModel();
  return (collection: Partitionable.CollectionName, index: number, data: Data.Formattable) => {
    putStorageModel(configModel.partitionable.setFilesystem(config, collection, index, data));
  };
}

type setSpacePolicyFn = (
  collection: DeviceCollection,
  index: number,
  data: Data.SpacePolicy,
) => void;

function useSetSpacePolicy(): setSpacePolicyFn {
  const model = useConfigModel();
  return (collection: DeviceCollection, index: number, data: Data.SpacePolicy) => {
    putStorageModel(configModel.device.setSpacePolicy(model, collection, index, data));
  };
}

function useConvertDevice() {
  const model = useConfigModel();
  const system = useSystem();

  return (deviceName: string, targetDeviceName: string) => {
    const device = findDeviceByName(system, deviceName);
    const targetDevice = findDeviceByName(system, targetDeviceName);

    if (device && targetDevice)
      putStorageModel(configModel.device.convert(model, device, targetDevice));
  };
}

const selectIsGrub2WithTpm = (config: ConfigModel.Config | null): boolean =>
  !isNullish(config) && configModel.isGrub2WithTpm(config);

function useIsGrub2WithTpm(): boolean {
  const { data } = useSuspenseQuery({
    ...configModelQuery,
    select: selectIsGrub2WithTpm,
  });
  return data;
}

function useIsTpmAvailable(): boolean {
  const system = useBootloaderSystem();
  const config = useConfigModel();
  const bootloaderType = config ? configModel.getBootloader(config) : null;

  if (isNullish(system) || isNullish(bootloaderType)) return false;

  return bootloaderSystem.isTpmAvailable(system, bootloaderType);
}

export {
  STORAGE_MODEL_KEY,
  useConfigModel,
  useSolvedConfigModel,
  useMissingMountPaths,
  useSetBootDevice,
  useSetDefaultBootDevice,
  useDisableBoot,
  useDevice,
  usePartitionable,
  useDrive,
  useAddDrive,
  useDeleteDrive,
  useMdRaid,
  useAddMdRaid,
  useDeleteMdRaid,
  useConvertPartitionableToVolumeGroup,
  useVolumeGroup,
  useAddVolumeGroup,
  useEditVolumeGroup,
  useDeleteVolumeGroup,
  useAddLogicalVolume,
  useEditLogicalVolume,
  useDeleteLogicalVolume,
  useAddPartition,
  useEditPartition,
  useDeletePartition,
  useSetEncryption,
  useSetFilesystem,
  useSetSpacePolicy,
  useConvertDevice,
  useIsGrub2WithTpm,
  useIsTpmAvailable,
};
