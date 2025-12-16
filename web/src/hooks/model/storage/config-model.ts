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
import { solveStorageModel, getStorageModel } from "~/api";
import configModel from "~/model/storage/config-model";
import type { ConfigModel, Partitionable } from "~/model/storage/config-model";

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

export {
  configModelQuery,
  useConfigModel,
  useSolvedConfigModel,
  useMissingMountPaths,
  usePartitionable,
  useDrive,
  useMdRaid,
};
