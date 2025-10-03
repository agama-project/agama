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

import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import {
  supportedZFCP,
  fetchZFCPConfig,
  fetchZFCPControllers,
  fetchZFCPDisks,
} from "~/api/storage/zfcp";
import { useInstallerClient } from "~/context/installer";
import React from "react";
import { ZFCPConfig, ZFCPController, ZFCPDisk } from "~/types/zfcp";

// FIXME: move this to sotaraKeys factory?
const storageZfcpKeys = {
  all: () => ["storage", "zfcp"] as const,
  config: () => [...storageZfcpKeys.all(), "config"] as const,
  controllers: () => [...storageZfcpKeys.all(), "controllers"] as const,
  disks: () => [...storageZfcpKeys.all(), "disks"] as const,
  supported: () => [...storageZfcpKeys.all(), "supported"] as const,
};

const zfcpControllersQuery = {
  queryKey: storageZfcpKeys.controllers(),
  queryFn: fetchZFCPControllers,
  staleTime: Infinity,
};

const zfcpDisksQuery = {
  queryKey: storageZfcpKeys.disks(),
  queryFn: fetchZFCPDisks,
  staleTime: Infinity,
};

const zfcpSupportedQuery = {
  queryKey: storageZfcpKeys.supported(),
  queryFn: supportedZFCP,
};

const zfcpConfigQuery = {
  queryKey: storageZfcpKeys.config(),
  queryFn: fetchZFCPConfig,
};

/**
 * Hook that returns zFCP controllers.
 */
const useZFCPControllers = (): ZFCPController[] => {
  const { data: controllers } = useSuspenseQuery(zfcpControllersQuery);
  return controllers;
};

/**
 * Hook that returns zFCP disks.
 */
const useZFCPDisks = (): ZFCPDisk[] => {
  const { data: devices } = useSuspenseQuery(zfcpDisksQuery);
  return devices;
};

/**
 * Hook that returns whether zFCP is supported.
 */
const useZFCPSupported = (): boolean => {
  const { data: supported } = useSuspenseQuery(zfcpSupportedQuery);
  return supported;
};

/**
 * Hook that returns zFCP config.
 */
const useZFCPConfig = (): ZFCPConfig => {
  const { data: config } = useSuspenseQuery(zfcpConfigQuery);
  return config;
};

/**
 * Listens for zFCP Controller changes.
 */
const useZFCPControllersChanges = () => {
  const client = useInstallerClient();
  const queryClient = useQueryClient();

  React.useEffect(() => {
    if (!client) return;

    return client.onEvent(({ type, device }) => {
      if (
        !["ZFCPControllerAdded", "ZFCPControllerChanged", "ZFCPControllerRemoved"].includes(type)
      ) {
        return;
      }
      queryClient.setQueryData(
        zfcpControllersQuery.queryKey,
        (prev: ZFCPController[] | undefined) => {
          if (prev === undefined) return;

          switch (type) {
            case "ZFCPControllerAdded": {
              return [...prev, device];
            }
            case "ZFCPControllerRemoved": {
              return prev.filter((dev) => dev.id !== device.id);
            }
            case "ZFCPControllerChanged": {
              return prev.map((d) => (d.id === device.id ? device : d));
            }
          }
        },
      );

      queryClient.invalidateQueries({ queryKey: ["zfcp", "controllers"] });
    });
  }, [client, queryClient]);
};

/**
 * Listens for zFCP disks changes.
 */
const useZFCPDisksChanges = () => {
  const client = useInstallerClient();
  const queryClient = useQueryClient();

  React.useEffect(() => {
    if (!client) return;

    return client.onEvent(({ type, device }) => {
      if (!["ZFCPDiskAdded", "ZFCPDiskChanged", "ZFCPDiskRemoved"].includes(type)) {
        return;
      }
      queryClient.setQueryData(storageZfcpKeys.disks(), (prev: ZFCPDisk[] | undefined) => {
        if (prev === undefined) return;

        switch (type) {
          case "ZFCPDiskAdded": {
            return [...prev, device];
          }
          case "ZFCPDiskRemoved": {
            return prev.filter((dev) => dev.name !== device.name);
          }
          case "ZFCPDiskChanged": {
            return prev.map((d) => (d.name === device.name ? device : d));
          }
        }
      });
    });
  }, [client, queryClient]);
};

export {
  useZFCPControllers,
  useZFCPControllersChanges,
  useZFCPDisks,
  useZFCPDisksChanges,
  useZFCPConfig,
  useZFCPSupported,
};
