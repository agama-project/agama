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
import { setConfigModel, solveConfigModel } from "~/api/storage";
import { apiModel, Volume } from "~/api/storage/types";
import { QueryHookOptions } from "~/types/queries";
import { apiModelQuery, useVolumes } from "~/queries/storage";

function copyModel(model: apiModel.Config): apiModel.Config {
  return JSON.parse(JSON.stringify(model));
}

function isNewPartition(partition: apiModel.Partition): boolean {
  return partition.name === undefined;
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

function usedMountPaths(model: apiModel.Config): string[] {
  const drives = model.drives || [];
  const volumeGroups = model.volumeGroups || [];
  const logicalVolumes = volumeGroups.flatMap((v) => v.logicalVolumes || []);

  return [...drives, ...logicalVolumes].flatMap(allMountPaths);
}

/** @depreacted Use useMissingMountPaths from ~/hooks/storage/product. */
function unusedMountPaths(model: apiModel.Config, volumes: Volume[]): string[] {
  const volPaths = volumes.filter((v) => v.mountPath.length).map((v) => v.mountPath);
  const assigned = usedMountPaths(model);
  return volPaths.filter((p) => !assigned.includes(p));
}

/*
 * Pretty artificial logic used to decide whether the UI should display buttons to remove
 * some drives. The logic is tricky and misplaced, but it is the lesser evil taking into
 * account the current code organization.
 *
 * TODO: Revisit when LVM support is added to the UI.
 */
function hasAdditionalDrives(model: apiModel.Config): boolean {
  if (model.drives.length <= 1) return false;
  if (model.drives.length > 2) return true;

  // If there are only two drives, the following logic avoids the corner case in which first
  // deleting one of them and then changing the boot settings can lead to zero disks. But it is far
  // from being fully reasonable or understandable for the user.
  const onlyToBoot = model.drives.find(
    (d) => isExplicitBoot(model, d.name) && !isUsedDrive(model, d.name),
  );

  return !onlyToBoot;
}

/** @deprecated Use useApiModel from ~/hooks/storage/api-model. */
export function useConfigModel(options?: QueryHookOptions): apiModel.Config {
  const query = apiModelQuery;
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

/** @deprecated Use useSolvedApiModel from ~/hooks/storage/api-model. */
export function useSolvedConfigModel(model?: apiModel.Config): apiModel.Config | null {
  const query = useSuspenseQuery({
    queryKey: ["storage", "solvedConfigModel", JSON.stringify(model)],
    queryFn: () => (model ? solveConfigModel(model) : Promise.resolve(null)),
    staleTime: Infinity,
  });

  return query.data;
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
  switch: (newName: string) => void;
  getPartition: (mountPath: string) => apiModel.Partition | undefined;
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
    switch: (newName) => mutate(switchDrive(model, name, newName)),
    delete: () => mutate(removeDrive(model, name)),
    getPartition: (mountPath: string) => findPartition(model, name, mountPath),
  };
}

export type ModelHook = {
  model: apiModel.Config;
  usedMountPaths: string[];
  unusedMountPaths: string[];
  // Hacky solution used to decide whether it makes sense to allow to remove drives
  hasAdditionalDrives: boolean;
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
    hasAdditionalDrives: hasAdditionalDrives(model),
  };
}
