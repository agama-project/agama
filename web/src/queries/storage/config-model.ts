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

import { useSuspenseQuery } from "@tanstack/react-query";
import { putStorageModel, solveStorageModel } from "~/api";
import { useConfigModel } from "~/hooks/model/storage";
import { useVolumeTemplates } from "~/hooks/model/system/storage";
import type { ConfigModel } from "~/model/storage";
import type { storage } from "~/model/system";

function copyModel(model: ConfigModel.Config): ConfigModel.Config {
  return JSON.parse(JSON.stringify(model));
}

function findDrive(model: ConfigModel.Config, driveName: string): ConfigModel.Drive | undefined {
  const drives = model?.drives || [];
  return drives.find((d) => d.name === driveName);
}

function findPartition(
  model: ConfigModel.Config,
  driveName: string,
  mountPath: string,
): ConfigModel.Partition | undefined {
  const drive = findDrive(model, driveName);
  if (drive === undefined) return undefined;

  const partitions = drive.partitions || [];
  return partitions.find((p) => p.mountPath === mountPath);
}

function isBoot(model: ConfigModel.Config, driveName: string): boolean {
  return model.boot?.configure && driveName === model.boot?.device?.name;
}

function isExplicitBoot(model: ConfigModel.Config, driveName: string): boolean {
  return !model.boot?.device?.default && driveName === model.boot?.device?.name;
}

function driveHasPv(model: ConfigModel.Config, name: string): boolean {
  if (!name) return false;

  return model.volumeGroups.flatMap((g) => g.targetDevices).includes(name);
}

function allMountPaths(drive: ConfigModel.Drive): string[] {
  if (drive.mountPath) return [drive.mountPath];

  return drive.partitions.map((p) => p.mountPath).filter((m) => m);
}

function setEncryption(
  originalModel: ConfigModel.Config,
  method: ConfigModel.EncryptionMethod,
  password: string,
): ConfigModel.Config {
  const model = copyModel(originalModel);
  model.encryption = { method, password };
  return model;
}

function disableEncryption(originalModel: ConfigModel.Config): ConfigModel.Config {
  const model = copyModel(originalModel);
  model.encryption = null;
  return model;
}

function addDrive(originalModel: ConfigModel.Config, driveName: string): ConfigModel.Config {
  if (findDrive(originalModel, driveName)) return;

  const model = copyModel(originalModel);
  model.drives.push({ name: driveName });

  return model;
}

function usedMountPaths(model: ConfigModel.Config): string[] {
  const drives = model.drives || [];
  const volumeGroups = model.volumeGroups || [];
  const logicalVolumes = volumeGroups.flatMap((v) => v.logicalVolumes || []);

  return [...drives, ...logicalVolumes].flatMap(allMountPaths);
}

/** @depreacted Use useMissingMountPaths from ~/hooks/storage/product. */
function unusedMountPaths(model: ConfigModel.Config, volumes: storage.Volume[]): string[] {
  const volPaths = volumes.filter((v) => v.mountPath.length).map((v) => v.mountPath);
  const assigned = usedMountPaths(model);
  return volPaths.filter((p) => !assigned.includes(p));
}

/** @deprecated Use useSolvedApiModel from ~/hooks/storage/api-model. */
export function useSolvedConfigModel(model?: ConfigModel.Config): ConfigModel.Config | null {
  const query = useSuspenseQuery({
    queryKey: ["storage", "solvedConfigModel", JSON.stringify(model)],
    queryFn: () => (model ? solveStorageModel(model) : Promise.resolve(null)),
    staleTime: Infinity,
  });

  return query.data;
}

export type EncryptionHook = {
  encryption?: ConfigModel.Encryption;
  enable: (method: ConfigModel.EncryptionMethod, password: string) => void;
  disable: () => void;
};

export function useEncryption(): EncryptionHook {
  const model = useConfigModel();

  return {
    encryption: model?.encryption,
    enable: (method: ConfigModel.EncryptionMethod, password: string) =>
      putStorageModel(setEncryption(model, method, password)),
    disable: () => putStorageModel(disableEncryption(model)),
  };
}

export type DriveHook = {
  isBoot: boolean;
  isExplicitBoot: boolean;
  hasPv: boolean;
  allMountPaths: string[];
  getPartition: (mountPath: string) => ConfigModel.Partition | undefined;
};

export function useDrive(name: string): DriveHook | null {
  const model = useConfigModel();
  const drive = findDrive(model, name);

  if (drive === undefined) return null;

  return {
    isBoot: isBoot(model, name),
    isExplicitBoot: isExplicitBoot(model, name),
    hasPv: driveHasPv(model, drive.name),
    allMountPaths: allMountPaths(drive),
    getPartition: (mountPath: string) => findPartition(model, name, mountPath),
  };
}

export type ModelHook = {
  model: ConfigModel.Config;
  usedMountPaths: string[];
  unusedMountPaths: string[];
  addDrive: (driveName: string) => void;
};

/**
 * Hook for operating on the collections of the model.
 */
export function useModel(): ModelHook {
  const model = useConfigModel();
  const volumes = useVolumeTemplates();

  return {
    model,
    addDrive: (driveName) => putStorageModel(addDrive(model, driveName)),
    usedMountPaths: model ? usedMountPaths(model) : [],
    unusedMountPaths: model ? unusedMountPaths(model, volumes) : [],
  };
}
