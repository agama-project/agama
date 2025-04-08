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

import { useMutation, useQuery, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import React, { useMemo } from "react";
import {
  fetchConfig,
  setConfig,
  resetConfig,
  fetchConfigModel,
  solveConfigModel,
  fetchActions,
  fetchVolume,
  fetchVolumes,
  fetchProductParams,
  fetchUsableDevices,
  reprobe,
} from "~/api/storage";
import { fetchDevices, fetchDevicesDirty } from "~/api/storage/devices";
import { useInstallerClient } from "~/context/installer";
import { config, apiModel, ProductParams, Volume } from "~/api/storage/types";
import { Action, StorageDevice } from "~/types/storage";
import { QueryHookOptions } from "~/types/queries";

const configQuery = {
  queryKey: ["storage", "config"],
  queryFn: fetchConfig,
  staleTime: Infinity,
};

const apiModelQuery = {
  queryKey: ["storage", "apiModel"],
  queryFn: fetchConfigModel,
  staleTime: Infinity,
};

const solveApiModelQuery = (apiModel?: apiModel.Config) => ({
  queryKey: ["storage", "solveApiModel", JSON.stringify(apiModel)],
  queryFn: () => (apiModel ? solveConfigModel(apiModel) : Promise.resolve(null)),
  staleTime: Infinity,
});

const devicesQuery = (scope: "result" | "system") => ({
  queryKey: ["storage", "devices", scope],
  queryFn: () => fetchDevices(scope),
  staleTime: Infinity,
});

const usableDevicesQuery = () => ({
  queryKey: ["storage", "usableDevices"],
  queryFn: fetchUsableDevices,
  staleTime: Infinity,
});

const productParamsQuery = {
  queryKey: ["storage", "productParams"],
  queryFn: fetchProductParams,
  staleTime: Infinity,
};

const volumeQuery = (mountPath: string) => ({
  queryKey: ["storage", "volume", mountPath],
  queryFn: () => fetchVolume(mountPath),
  staleTime: Infinity,
});

const volumesQuery = (mountPaths: string[]) => ({
  queryKey: ["storage", "volumes"],
  queryFn: () => fetchVolumes(mountPaths),
  staleTime: Infinity,
});

const actionsQuery = {
  queryKey: ["storage", "devices", "actions"],
  queryFn: fetchActions,
};

const deprecatedQuery = {
  queryKey: ["storage", "dirty"],
  queryFn: fetchDevicesDirty,
};

/**
 * Hook that returns the unsolved config.
 */
const useConfig = (options?: QueryHookOptions): config.Config => {
  const query = configQuery;
  const func = options?.suspense ? useSuspenseQuery : useQuery;
  const { data } = func(query);
  return data;
};

/**
 * Hook for setting a new config.
 */
const useConfigMutation = () => {
  const queryClient = useQueryClient();
  const query = {
    mutationFn: async (config: config.Config) => await setConfig(config),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["storage"] }),
  };

  return useMutation(query);
};

/**
 * Hook for setting the default config.
 */
const useResetConfigMutation = () => {
  const queryClient = useQueryClient();
  const query = {
    mutationFn: async () => await resetConfig(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["storage"] }),
  };

  return useMutation(query);
};

/**
 * Hook that returns the list of storage devices for the given scope.
 *
 * @param scope - "system": devices in the current state of the system; "result":
 *   devices in the proposal ("stage")
 */
const useDevices = (
  scope: "result" | "system",
  options?: QueryHookOptions,
): StorageDevice[] | undefined => {
  const query = devicesQuery(scope);
  const func = options?.suspense ? useSuspenseQuery : useQuery;
  const { data } = func(query);
  return data;
};

/**
 * Hook that returns the list of available devices for installation.
 */
const useAvailableDevices = (): StorageDevice[] => {
  const devices = useDevices("system", { suspense: true });
  const { data: usableDevices } = useSuspenseQuery(usableDevicesQuery());

  const availableDevices = useMemo(() => {
    /** @todo Extract this function to some shared place. */
    const findDevice = (devices: StorageDevice[], sid: number): StorageDevice | undefined => {
      const device = devices.find((d) => d.sid === sid);
      if (device === undefined) console.warn("Device not found:", sid);

      return device;
    };
    return usableDevices.map((sid: number) => findDevice(devices, sid)).filter((d) => d);
  }, [devices, usableDevices]);

  return availableDevices;
};

/**
 * @deprecated Use useProductParams from ~/hooks/storage/product.
 * Hook that returns the product parameters (e.g., mount points).
 */
const useProductParams = (options?: QueryHookOptions): ProductParams => {
  const func = options?.suspense ? useSuspenseQuery : useQuery;
  const { data } = func(productParamsQuery);
  return data;
};

/**
 * Hook that returns the available encryption methods.
 *
 * @note The ids of the encryption methods reported by product params are different to the
 * EncryptionMethod values. This should be fixed at the bakcend size.
 */
const useEncryptionMethods = (options?: QueryHookOptions): apiModel.EncryptionMethod[] => {
  const productParams = useProductParams(options);

  const encryptionMethods = React.useMemo((): apiModel.EncryptionMethod[] => {
    const conversions = {
      luks1: "luks1",
      luks2: "luks2",
      pervasive_encryption: "pervasiveEncryption",
      tpm_fde: "tpmFde",
      protected_swap: "protectedSwap",
      secure_swap: "secureSwap",
      random_swap: "randomSwap",
    };

    const apiMethods = productParams?.encryptionMethods || [];
    return apiMethods.map((v) => conversions[v] || "luks2");
  }, [productParams]);

  return encryptionMethods;
};

/**
 * Hook that returns the volumes for the current product.
 */
const useVolumes = (): Volume[] => {
  const product = useProductParams({ suspense: true });
  const mountPoints = ["", ...product.mountPoints];
  const { data } = useSuspenseQuery(volumesQuery(mountPoints));
  return data;
};

/** @deprecated Use useVolume from ~/hooks/storage/product. */
function useVolume(mountPoint: string): Volume {
  const volumes = useVolumes();
  const volume = volumes.find((v) => v.mountPath === mountPoint);
  const defaultVolume = volumes.find((v) => v.mountPath === "");
  return volume || defaultVolume;
}

/**
 * Hook that returns the devices that can be selected as target for volume.
 *
 * A device can be selected as target for a volume if either it is an available device for
 * installation or it is a device built over the available devices for installation. For example,
 * a MD RAID is a possible target only if all its members are available devices or children of the
 * available devices.
 */
const useVolumeDevices = (): StorageDevice[] => {
  const availableDevices = useAvailableDevices();

  const isAvailable = (device: StorageDevice) => {
    const isChildren = (device: StorageDevice, parentDevice: StorageDevice) => {
      const partitions = parentDevice.partitionTable?.partitions || [];
      return !!partitions.find((d) => d.name === device.name);
    };

    return !!availableDevices.find((d) => d.name === device.name || isChildren(device, d));
  };

  const allAvailable = (devices: StorageDevice[]) => devices.every(isAvailable);

  const system = useDevices("system", { suspense: true });
  const mds = system.filter((d) => d.type === "md" && allAvailable(d.devices));
  const vgs = system.filter((d) => d.type === "lvmVg" && allAvailable(d.physicalVolumes));

  return [...availableDevices, ...mds, ...vgs];
};

/**
 * Hook that returns the actions to perform in the storage devices.
 */
const useActions = (): Action[] => {
  const { data } = useSuspenseQuery(actionsQuery);
  return data;
};

/**
 * Hook that returns whether the storage devices are "dirty".
 */
const useDeprecated = () => {
  const { isPending, data } = useQuery(deprecatedQuery);
  return isPending ? false : data;
};

/**
 * Hook that listens for changes to the devices dirty property.
 */
const useDeprecatedChanges = () => {
  const client = useInstallerClient();
  const queryClient = useQueryClient();

  React.useEffect(() => {
    if (!client) return;

    return client.onEvent(({ type, dirty: value }) => {
      if (type === "DevicesDirty") {
        queryClient.setQueryData(deprecatedQuery.queryKey, value);
      }
    });
  });
};

/**
 * Hook that reprobes the devices and recalculates the proposal using the current settings.
 */
const useReprobeMutation = () => {
  const queryClient = useQueryClient();
  const query = {
    mutationFn: async () => {
      await reprobe();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["storage"] }),
  };

  return useMutation(query);
};

export {
  productParamsQuery,
  apiModelQuery,
  solveApiModelQuery,
  volumeQuery,
  useConfig,
  useConfigMutation,
  useResetConfigMutation,
  useDevices,
  useAvailableDevices,
  useEncryptionMethods,
  useVolumes,
  useVolume,
  useVolumeDevices,
  useActions,
  useDeprecated,
  useDeprecatedChanges,
  useReprobeMutation,
};
