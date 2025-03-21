/*
 * Copyright (c) [2024-2025] SUSE LLC
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

/** @deprecated These hooks will be replaced by new hooks at ~/hooks/storage/ */

import { useMutation, useQuery, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { fetchConfigModel, setConfigModel, solveConfigModel } from "~/api/storage";
import { apiModel, Volume } from "~/api/storage/types";
import { QueryHookOptions } from "~/types/queries";
import { SpacePolicyAction } from "~/types/storage";
import { useVolumes } from "~/queries/storage";

function copyModel(model: apiModel.Config): apiModel.Config {
  return JSON.parse(JSON.stringify(model));
}

function isNewPartition(partition: apiModel.Partition): boolean {
  return partition.name === undefined;
}

function isSpacePartition(partition: apiModel.Partition): boolean {
  return partition.resizeIfNeeded || partition.delete || partition.deleteIfNeeded;
}

function isUsedPartition(partition: apiModel.Partition): boolean {
  return partition.filesystem !== undefined;
}

function isReusedPartition(partition: apiModel.Partition): boolean {
  return !isNewPartition(partition) && isUsedPartition(partition);
}

function findDrive(model: apiModel.Config, driveName: string): apiModel.Drive | undefined {
  const drives = model?.drives || [];
  return drives.find((d) => d.name === driveName);
}

function removeDrive(model: apiModel.Config, driveName: string): apiModel.Config {
  model.drives = model.drives.filter((d) => d.name !== driveName);
  return model;
}

function isUsedDrive(model: apiModel.Config, driveName: string) {
  const drive = findDrive(model, driveName);
  if (drive === undefined) return false;

  return drive.partitions?.some((p) => isNewPartition(p) || isReusedPartition(p));
}

function findPartition(
  model: apiModel.Config,
  driveName: string,
  mountPath: string,
): apiModel.Partition | undefined {
  const drive = findDrive(model, driveName);
  if (drive === undefined) return undefined;

  const partitions = drive.partitions || [];
  return partitions.find((p) => p.mountPath === mountPath);
}

function isBoot(model: apiModel.Config, driveName: string): boolean {
  return model.boot?.configure && driveName === model.boot?.device?.name;
}

function isExplicitBoot(model: apiModel.Config, driveName: string): boolean {
  return !model.boot?.device?.default && driveName === model.boot?.device?.name;
}

function driveHasPv(model: apiModel.Config, name: string): boolean {
  if (!name) return false;

  return model.volumeGroups.flatMap((g) => g.targetDevices).includes(name);
}

function allMountPaths(drive: apiModel.Drive): string[] {
  if (drive.mountPath) return [drive.mountPath];

  return drive.partitions.map((p) => p.mountPath).filter((m) => m);
}

function configuredExistingPartitions(drive: apiModel.Drive): apiModel.Partition[] {
  const allPartitions = drive.partitions || [];

  if (drive.spacePolicy === "custom")
    return allPartitions.filter(
      (p) => !isNewPartition(p) && (isUsedPartition(p) || isSpacePartition(p)),
    );

  return allPartitions.filter((p) => isReusedPartition(p));
}

function setBoot(originalModel: apiModel.Config, boot: apiModel.Boot) {
  const model = copyModel(originalModel);
  const name = model.boot?.device?.name;
  const remove =
    name !== undefined &&
    isExplicitBoot(model, name) &&
    !isUsedDrive(model, name) &&
    !driveHasPv(model, name);

  if (remove) removeDrive(model, name);

  model.boot = boot;
  return model;
}

function setBootDevice(originalModel: apiModel.Config, deviceName: string): apiModel.Config {
  return setBoot(originalModel, {
    configure: true,
    device: {
      default: false,
      name: deviceName,
    },
  });
}

function setDefaultBootDevice(originalModel: apiModel.Config): apiModel.Config {
  return setBoot(originalModel, {
    configure: true,
    device: {
      default: true,
    },
  });
}

function disableBoot(originalModel: apiModel.Config): apiModel.Config {
  return setBoot(originalModel, { configure: false });
}

function setEncryption(
  originalModel: apiModel.Config,
  method: apiModel.EncryptionMethod,
  password: string,
): apiModel.Config {
  const model = copyModel(originalModel);
  model.encryption = { method, password };
  return model;
}

function disableEncryption(originalModel: apiModel.Config): apiModel.Config {
  const model = copyModel(originalModel);
  model.encryption = null;
  return model;
}

function deletePartition(
  originalModel: apiModel.Config,
  driveName: string,
  mountPath: string,
): apiModel.Config {
  const model = copyModel(originalModel);
  const drive = findDrive(model, driveName);
  if (drive === undefined) return;

  const partitions = (drive.partitions || []).filter((p) => p.mountPath !== mountPath);
  drive.partitions = partitions;
  return model;
}

/**
 * Adds a new partition.
 *
 * If a partition already exists in the model (e.g., as effect of using the custom policy), then
 * the partition is replaced.
 * */
export function addPartition(
  originalModel: apiModel.Config,
  driveName: string,
  partition: apiModel.Partition,
): apiModel.Config {
  const model = copyModel(originalModel);
  const drive = findDrive(model, driveName);
  if (drive === undefined) return;

  drive.partitions ||= [];
  const index = drive.partitions.findIndex((p) => p.name && p.name === partition.name);

  if (index === -1) drive.partitions.push(partition);
  else drive.partitions[index] = partition;

  return model;
}

export function editPartition(
  originalModel: apiModel.Config,
  driveName: string,
  mountPath: string,
  partition: apiModel.Partition,
): apiModel.Config {
  const model = copyModel(originalModel);
  const drive = findDrive(model, driveName);
  const partitions = drive?.partitions || [];
  const index = partitions.findIndex((p) => p.mountPath === mountPath);

  if (index === -1) return;
  else drive.partitions[index] = partition;

  return model;
}

function switchDrive(
  originalModel: apiModel.Config,
  driveName: string,
  newDriveName: string,
): apiModel.Config {
  if (driveName === newDriveName) return;

  const model = copyModel(originalModel);
  const drive = findDrive(model, driveName);
  if (drive === undefined) return;

  const newPartitions = (drive.partitions || []).filter(isNewPartition);
  const existingPartitions = (drive.partitions || []).filter((p) => !isNewPartition(p));
  const reusedPartitions = existingPartitions.filter(isReusedPartition);
  const keepDrive = isExplicitBoot(model, driveName) || reusedPartitions.length;
  const newDrive = findDrive(model, newDriveName);

  if (keepDrive) {
    drive.partitions = existingPartitions;
  } else {
    removeDrive(model, driveName);
  }

  if (newDrive) {
    newDrive.partitions ||= [];
    newDrive.partitions = [...newDrive.partitions, ...newPartitions];
  } else {
    model.drives.push({
      name: newDriveName,
      partitions: newPartitions,
      spacePolicy: drive.spacePolicy === "custom" ? undefined : drive.spacePolicy,
    });
  }

  return model;
}

function addDrive(originalModel: apiModel.Config, driveName: string): apiModel.Config {
  if (findDrive(originalModel, driveName)) return;

  const model = copyModel(originalModel);
  model.drives.push({ name: driveName });

  return model;
}

function setCustomSpacePolicy(
  originalModel: apiModel.Config,
  driveName: string,
  actions: SpacePolicyAction[],
): apiModel.Config {
  const model = copyModel(originalModel);
  const drive = findDrive(model, driveName);
  if (drive === undefined) return model;

  drive.spacePolicy = "custom";
  drive.partitions ||= [];

  // Reset resize/delete actions of all current partition configs.
  drive.partitions
    .filter((p) => p.name !== undefined)
    .forEach((partition) => {
      partition.delete = false;
      partition.deleteIfNeeded = false;
      partition.resizeIfNeeded = false;
      partition.size = undefined;
    });

  // Apply the given actions.
  actions.forEach(({ deviceName, value }) => {
    const isDelete = value === "delete";
    const isResizeIfNeeded = value === "resizeIfNeeded";
    const partition = drive.partitions.find((p) => p.name === deviceName);

    if (partition) {
      partition.delete = isDelete;
      partition.resizeIfNeeded = isResizeIfNeeded;
    } else {
      drive.partitions.push({
        name: deviceName,
        delete: isDelete,
        resizeIfNeeded: isResizeIfNeeded,
      });
    }
  });

  return model;
}

function setSpacePolicy(
  originalModel: apiModel.Config,
  driveName: string,
  spacePolicy: apiModel.SpacePolicy,
  actions?: SpacePolicyAction[],
): apiModel.Config {
  if (spacePolicy === "custom")
    return setCustomSpacePolicy(originalModel, driveName, actions || []);

  const model = copyModel(originalModel);
  const drive = findDrive(model, driveName);
  if (drive !== undefined) drive.spacePolicy = spacePolicy;

  return model;
}

function usedMountPaths(model: apiModel.Config): string[] {
  const drives = model.drives || [];
  const volumeGroups = model.volumeGroups || [];
  const logicalVolumes = volumeGroups.flatMap((v) => v.logicalVolumes || []);

  return [...drives, ...logicalVolumes].flatMap(allMountPaths);
}

function unusedMountPaths(model: apiModel.Config, volumes: Volume[]): string[] {
  const volPaths = volumes.filter((v) => v.mountPath.length).map((v) => v.mountPath);
  const assigned = usedMountPaths(model);
  return volPaths.filter((p) => !assigned.includes(p));
}

const configModelQuery = {
  queryKey: ["storage", "configModel"],
  queryFn: fetchConfigModel,
  staleTime: Infinity,
};

/**
 * Hook that returns the config model.
 */
export function useConfigModel(options?: QueryHookOptions): apiModel.Config {
  const query = configModelQuery;
  const func = options?.suspense ? useSuspenseQuery : useQuery;
  const { data } = func(query);
  return data;
}

/**
 * Hook for setting a new config model.
 */
export function useConfigModelMutation() {
  const queryClient = useQueryClient();
  const query = {
    mutationFn: (model: apiModel.Config) => setConfigModel(model),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["storage"] }),
  };

  return useMutation(query);
}

/**
 * @todo Use a hash key from the model object as id for the query.
 * Hook that returns the config model.
 */
export function useSolvedConfigModel(model?: apiModel.Config): apiModel.Config | null {
  const query = useSuspenseQuery({
    queryKey: ["storage", "solvedConfigModel", JSON.stringify(model)],
    queryFn: () => (model ? solveConfigModel(model) : Promise.resolve(null)),
    staleTime: Infinity,
  });

  return query.data;
}

export type BootHook = {
  configure: boolean;
  isDefault: boolean;
  deviceName?: string;
  setDevice: (deviceName: string) => void;
  setDefault: () => void;
  disable: () => void;
};

export function useBoot(): BootHook {
  const model = useConfigModel();
  const { mutate } = useConfigModelMutation();

  return {
    configure: model?.boot?.configure || false,
    isDefault: model?.boot?.device?.default || false,
    deviceName: model?.boot?.device?.name,
    setDevice: (deviceName: string) => mutate(setBootDevice(model, deviceName)),
    setDefault: () => mutate(setDefaultBootDevice(model)),
    disable: () => mutate(disableBoot(model)),
  };
}

export type EncryptionHook = {
  encryption?: apiModel.Encryption;
  enable: (method: apiModel.EncryptionMethod, password: string) => void;
  disable: () => void;
};

export function useEncryption(): EncryptionHook {
  const model = useConfigModel();
  const { mutate } = useConfigModelMutation();

  return {
    encryption: model?.encryption,
    enable: (method: apiModel.EncryptionMethod, password: string) =>
      mutate(setEncryption(model, method, password)),
    disable: () => mutate(disableEncryption(model)),
  };
}

export type DriveHook = {
  isBoot: boolean;
  isExplicitBoot: boolean;
  hasPv: boolean;
  allMountPaths: string[];
  configuredExistingPartitions: apiModel.Partition[];
  switch: (newName: string) => void;
  getPartition: (mountPath: string) => apiModel.Partition | undefined;
  addPartition: (partition: apiModel.Partition) => void;
  editPartition: (mountPath: string, partition: apiModel.Partition) => void;
  deletePartition: (mountPath: string) => void;
  setSpacePolicy: (policy: apiModel.SpacePolicy, actions?: SpacePolicyAction[]) => void;
  delete: () => void;
};

export function useDrive(name: string): DriveHook | null {
  const model = useConfigModel();
  const { mutate } = useConfigModelMutation();
  const drive = findDrive(model, name);

  if (drive === undefined) return null;

  return {
    isBoot: isBoot(model, name),
    isExplicitBoot: isExplicitBoot(model, name),
    hasPv: driveHasPv(model, drive.name),
    allMountPaths: allMountPaths(drive),
    configuredExistingPartitions: configuredExistingPartitions(drive),
    switch: (newName) => mutate(switchDrive(model, name, newName)),
    delete: () => mutate(removeDrive(model, name)),
    getPartition: (mountPath: string) => findPartition(model, name, mountPath),
    addPartition: (partition: apiModel.Partition) => mutate(addPartition(model, name, partition)),
    editPartition: (mountPath: string, partition: apiModel.Partition) =>
      mutate(editPartition(model, name, mountPath, partition)),
    deletePartition: (mountPath: string) => mutate(deletePartition(model, name, mountPath)),
    setSpacePolicy: (policy: apiModel.SpacePolicy, actions?: SpacePolicyAction[]) =>
      mutate(setSpacePolicy(model, name, policy, actions)),
  };
}

export type ModelHook = {
  model: apiModel.Config;
  usedMountPaths: string[];
  unusedMountPaths: string[];
  addDrive: (driveName: string) => void;
};

/**
 * Hook for operating on the collections of the model.
 */
export function useModel(): ModelHook {
  const model = useConfigModel();
  const { mutate } = useConfigModelMutation();
  const volumes = useVolumes();

  return {
    model,
    addDrive: (driveName) => mutate(addDrive(model, driveName)),
    usedMountPaths: model ? usedMountPaths(model) : [],
    unusedMountPaths: model ? unusedMountPaths(model, volumes) : [],
  };
}

export { configModelQuery };
