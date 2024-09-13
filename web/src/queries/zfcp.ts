/*
 * Copyright (c) [2024] SUSE LLC
 *
 * All Rights Reserved.
 *
 * This program is free software; you can redistribute it and/or modify it
 * under the terms of version 2 of the GNU General Public License as published
 * by the Free Software Foundation.
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
import { _ } from "~/i18n";
import { ZFCPSupported, fetchZFCPConfig, fetchZFCPControllers, fetchZFCPDisks } from "~/api/zfcp";
import { useInstallerClient } from "~/context/installer";
import React from "react";
import { ZFCPConfig, ZFCPController, ZFCPDisk } from "~/types/zfcp";

/**
 * Returns a query for retrieving the zFCP controllers
 */
const ZFCPControllersQuery = () => ({
  queryKey: ["zfcp", "controllers"],
  queryFn: fetchZFCPControllers,
});

/**
 * Returns a query for retrieving the zFCP disks
 */
const ZFCPDisksQuery = () => ({
  queryKey: ["zfcp", "disks"],
  queryFn: fetchZFCPDisks,
});

/**
 * Returns a query for checking if zFCP is supported
 */
const ZFCPSupportedQuery = () => ({
  queryKey: ["zfcp", "supported"],
  queryFn: ZFCPSupported,
});
/**
 * Returns a query for retrieving the zFCP config
 */
const ZFCPConfigQuery = () => ({
  queryKey: ["zfcp", "config"],
  queryFn: fetchZFCPConfig,
});

/**
 * Hook that returns zFCP controllers.
 */
const useZFCPControllers = (): ZFCPController[] => {
  const { data: controllers } = useSuspenseQuery(ZFCPControllersQuery());
  return controllers;
};

/**
 * Hook that returns zFCP disks.
 */
const useZFCPDisks = (): ZFCPDisk[] => {
  const { data: devices } = useSuspenseQuery(ZFCPDisksQuery());
  return devices;
};

/**
 * Hook that returns zFCP config.
 */
const useZFCPSupported = (): boolean => {
  const { data: supported } = useSuspenseQuery(ZFCPSupportedQuery());
  return supported;
};
/**
 * Hook that returns zFCP config.
 */
const useZFCPConfig = (): ZFCPConfig => {
  const { data: config } = useSuspenseQuery(ZFCPConfigQuery());
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

    return client.ws().onEvent((event) => {
      switch (event.type) {
        case "ZFCPControllerAdded": {
          const device: ZFCPController = event.device;
          queryClient.setQueryData(["zfcp", "controllers"], (prev: ZFCPController[]) => {
            return [...prev, device];
          });
          break;
        }
        case "ZFCPControllerRemoved": {
          const device: ZFCPController = event.device;
          const { id } = device;
          queryClient.setQueryData(["zfcp", "controllers"], (prev: ZFCPController[]) => {
            const res = prev.filter((dev) => dev.id !== id);
            return res;
          });
          break;
        }
        case "ZFCPControllerChanged": {
          const device: ZFCPController = event.device;
          const { id } = device;
          queryClient.setQueryData(["zfcp", "controllers"], (prev: ZFCPController[]) => {
            // deep copy of original to have it immutable
            const res = [...prev];
            const index = res.findIndex((dev) => dev.id === id);
            res[index] = device;
            return res;
          });
          break;
        }
      }
    });
  });
};

/**
 * Listens for zFCP disks changes.
 */
const useZFCPDisksChanges = () => {
  const client = useInstallerClient();
  const queryClient = useQueryClient();

  React.useEffect(() => {
    if (!client) return;

    return client.ws().onEvent((event) => {
      switch (event.type) {
        case "ZFCPDiskAdded": {
          const device: ZFCPDisk = event.device;
          queryClient.setQueryData(["zfcp", "disks"], (prev: ZFCPDisk[]) => {
            return [...prev, device];
          });
          break;
        }
        case "ZFCPDiskRemoved": {
          const device: ZFCPDisk = event.device;
          const { name } = device;
          queryClient.setQueryData(["zfcp", "disks"], (prev: ZFCPDisk[]) => {
            const res = prev.filter((dev) => dev.name !== name);
            return res;
          });
          break;
        }
        case "ZFCPDiskChanged": {
          const device: ZFCPDisk = event.device;
          const { name } = device;
          queryClient.setQueryData(["zfcp", "disks"], (prev: ZFCPDisk[]) => {
            // deep copy of original to have it immutable
            const res = [...prev];
            const index = res.findIndex((dev) => dev.name === name);
            res[index] = device;
            return res;
          });
          break;
        }
      }
    });
  });
};

export {
  useZFCPControllers,
  useZFCPControllersChanges,
  useZFCPDisks,
  useZFCPDisksChanges,
  useZFCPConfig,
  useZFCPSupported,
};
