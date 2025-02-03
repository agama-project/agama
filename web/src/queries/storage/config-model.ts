/*
 * Copyright (c) [2024] SUSE LLC
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

import { useMutation, useQuery, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { fetchConfigModel, setConfigModel, solveConfigModel } from "~/api/storage";
import { configModel } from "~/api/storage/types";
import { QueryHookOptions } from "~/types/queries";
import { SpacePolicyAction } from "~/types/storage";

function copyModel(model: configModel.Config): configModel.Config {
  return JSON.parse(JSON.stringify(model));
}

function isNewPartition(partition: configModel.Partition): boolean {
  return partition.name === undefined;
}

function isSpacePartition(partition: configModel.Partition): boolean {
  return partition.resizeIfNeeded || partition.delete || partition.deleteIfNeeded;
}

function isUsedPartition(partition: configModel.Partition): boolean {
  return partition.filesystem !== undefined || partition.alias !== undefined;
}

function isReusedPartition(partition: configModel.Partition): boolean {
  return !isNewPartition(partition) && isUsedPartition(partition) && !isSpacePartition(partition);
}

function findDrive(model: configModel.Config, driveName: string): configModel.Drive | undefined {
  const drives = model?.drives || [];
  return drives.find((d) => d.name === driveName);
}

function removeDrive(model: configModel.Config, driveName: string): configModel.Config {
  model.drives = model.drives.filter((d) => d.name !== driveName);
  return model;
}

function isUsedDrive(model: configModel.Config, driveName: string) {
  const drive = findDrive(model, driveName);
  if (drive === undefined) return false;

  return drive.partitions?.some((p) => isNewPartition(p) || isReusedPartition(p));
}

function findPartition(
  model: configModel.Config,
  driveName: string,
  mountPath: string,
): configModel.Partition | undefined {
  const drive = findDrive(model, driveName);
  if (drive === undefined) return undefined;

  const partitions = drive.partitions || [];
  return partitions.find((p) => p.mountPath === mountPath);
}

function isBoot(model: configModel.Config, driveName: string): boolean {
  return model.boot?.configure && driveName === model.boot?.device?.name;
}

function isExplicitBoot(model: configModel.Config, driveName: string): boolean {
  return !model.boot?.device?.default && driveName === model.boot?.device?.name;
}

function allMountPaths(drive: configModel.Drive): string[] {
  if (drive.mountPath) return [drive.mountPath];

  return drive.partitions.map((p) => p.mountPath).filter((m) => m);
}

function configuredExistingPartitions(drive: configModel.Drive): configModel.Partition[] {
  const allPartitions = drive.partitions || [];

  if (drive.spacePolicy === "custom") return allPartitions.filter((p) => p.name);

  return allPartitions.filter((p) => p.name && p.mountPath);
}

function setBoot(originalModel: configModel.Config, boot: configModel.Boot) {
  const model = copyModel(originalModel);
  const name = model.boot?.device?.name;
  const remove = name !== undefined && isExplicitBoot(model, name) && !isUsedDrive(model, name);

  if (remove) removeDrive(model, name);

  model.boot = boot;
  return model;
}

function setBootDevice(originalModel: configModel.Config, deviceName: string): configModel.Config {
  return setBoot(originalModel, {
    configure: true,
    device: {
      default: false,
      name: deviceName,
    },
  });
}

function setDefaultBootDevice(originalModel: configModel.Config): configModel.Config {
  return setBoot(originalModel, {
    configure: true,
    device: {
      default: true,
    },
  });
}

function disableBoot(originalModel: configModel.Config): configModel.Config {
  return setBoot(originalModel, { configure: false });
}

function deletePartition(
  originalModel: configModel.Config,
  driveName: string,
  mountPath: string,
): configModel.Config {
  const model = copyModel(originalModel);
  const drive = findDrive(model, driveName);
  if (drive === undefined) return;

  const partitions = (drive.partitions || []).filter((p) => p.mountPath !== mountPath);
  drive.partitions = partitions;
  return model;
}

export function addPartition(
  originalModel: configModel.Config,
  driveName: string,
  partition: configModel.Partition,
): configModel.Config {
  const model = copyModel(originalModel);
  const drive = findDrive(model, driveName);
  if (drive === undefined) return;

  drive.partitions.push(partition);
  return model;
}

function switchDrive(
  originalModel: configModel.Config,
  driveName: string,
  newDriveName: string,
): configModel.Config {
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

function setCustomSpacePolicy(
  originalModel: configModel.Config,
  driveName: string,
  actions: SpacePolicyAction[],
): configModel.Config {
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
  originalModel: configModel.Config,
  driveName: string,
  spacePolicy: configModel.SpacePolicy,
  actions?: SpacePolicyAction[],
): configModel.Config {
  if (spacePolicy === "custom")
    return setCustomSpacePolicy(originalModel, driveName, actions || []);

  const model = copyModel(originalModel);
  const drive = findDrive(model, driveName);
  if (drive !== undefined) drive.spacePolicy = spacePolicy;

  return model;
}

const configModelQuery = {
  queryKey: ["storage", "configModel"],
  queryFn: fetchConfigModel,
  staleTime: Infinity,
};

/**
 * Hook that returns the config model.
 */
export function useConfigModel(options?: QueryHookOptions): configModel.Config {
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
    mutationFn: (model: configModel.Config) => setConfigModel(model),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["storage"] }),
  };

  return useMutation(query);
}

/**
 * @todo Use a hash key from the model object as id for the query.
 * Hook that returns the config model.
 */
export function useSolvedConfigModel(model?: configModel.Config): configModel.Config | null {
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

export type PartitionHook = {
  delete: () => void;
};

/**
 * @param driveName like "/dev/sda"
 * @param mountPath like "/" or "swap"
 */
export function usePartition(driveName: string, mountPath: string): PartitionHook | undefined {
  const model = useConfigModel();
  const { mutate } = useConfigModelMutation();

  if (findPartition(model, driveName, mountPath) === undefined) return;

  return {
    delete: () => mutate(deletePartition(model, driveName, mountPath)),
  };
}

export type DriveHook = {
  isBoot: boolean;
  isExplicitBoot: boolean;
  allMountPaths: string[];
  configuredExistingPartitions: configModel.Partition[];
  switch: (newName: string) => void;
  addPartition: (partition: configModel.Partition) => void;
  setSpacePolicy: (policy: configModel.SpacePolicy, actions?: SpacePolicyAction[]) => void;
  delete: () => void;
};

export function useDrive(name: string): DriveHook | undefined {
  const model = useConfigModel();
  const { mutate } = useConfigModelMutation();
  const drive = findDrive(model, name);

  if (drive === undefined) return;

  return {
    isBoot: isBoot(model, name),
    isExplicitBoot: isExplicitBoot(model, name),
    allMountPaths: allMountPaths(drive),
    configuredExistingPartitions: configuredExistingPartitions(drive),
    switch: (newName) => mutate(switchDrive(model, name, newName)),
    delete: () => mutate(removeDrive(model, name)),
    addPartition: (partition: configModel.Partition) =>
      mutate(addPartition(model, name, partition)),
    setSpacePolicy: (policy: configModel.SpacePolicy, actions?: SpacePolicyAction[]) =>
      mutate(setSpacePolicy(model, name, policy, actions)),
  };
}
