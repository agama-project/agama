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
import { fetchConfigModel, setConfigModel } from "~/api/storage";
import { configModel } from "~/api/storage/types";
import { QueryHookOptions } from "~/types/queries";
import { SpacePolicyAction } from "~/types/storage";

function findDrive(model: configModel.Config, driveName: string): configModel.Drive | undefined {
  const drives = model.drives || [];
  return drives.find((d) => d.name === driveName);
}

// TODO: add a second drive if needed (e.g., reusing a partition).
function changeDrive(model: configModel.Config, driveName: string, newDriveName: string) {
  const drive = findDrive(model, driveName);
  if (drive === undefined) return;

  drive.name = newDriveName;
  if (drive.spacePolicy === "custom") drive.spacePolicy = "keep";
}

function setSpacePolicy(
  model: configModel.Config,
  driveName: string,
  spacePolicy: "keep" | "delete" | "resize",
) {
  const drive = findDrive(model, driveName);
  if (drive === undefined) return;

  drive.spacePolicy = spacePolicy;
}

function setCustomSpacePolicy(
  model: configModel.Config,
  driveName: string,
  actions: SpacePolicyAction[],
) {
  const drive = findDrive(model, driveName);
  if (drive === undefined) return;

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

type ModelActionF = (model: configModel.Config) => void;

function useApplyModelAction() {
  const originalModel = useConfigModel({ suspense: true });
  const { mutate } = useConfigModelMutation();

  const model = JSON.parse(JSON.stringify(originalModel));

  return (action: ModelActionF) => {
    action(model);
    mutate(model);
  };
}

export function useChangeDrive() {
  const applyModelAction = useApplyModelAction();

  return (driveName: string, newDriveName: string) => {
    const action: ModelActionF = (model) => changeDrive(model, driveName, newDriveName);
    applyModelAction(action);
  };
}

export function useSetSpacePolicy() {
  const applyModelAction = useApplyModelAction();

  return (deviceName: string, spacePolicy: "keep" | "delete" | "resize") => {
    const action: ModelActionF = (model) => setSpacePolicy(model, deviceName, spacePolicy);
    applyModelAction(action);
  };
}

export function useSetCustomSpacePolicy() {
  const applyModelAction = useApplyModelAction();

  return (deviceName: string, actions: SpacePolicyAction[]) => {
    const action: ModelActionF = (model) => setCustomSpacePolicy(model, deviceName, actions);
    applyModelAction(action);
  };
}
