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

import React, { useCallback } from "react";
import { useQueryClient, useMutation } from "@tanstack/react-query";
import { useInstallerClient } from "~/context/installer";
import {
  AccessPoint,
  Connection,
  ConnectionState,
  Device,
  DeviceState,
  NetworkGeneralState,
  WifiNetwork,
  WifiNetworkStatus,
} from "~/types/network";
import { useNetworkProposal } from "./proposal";
import { useNetworkSystem } from "./system";
import { updateConfig } from "~/api/api";

/**
 * Hook that builds a mutation to update a network connection
 *
 * It does not require to call `useMutation`.
 */
const useConfigMutation = () => {
  const queryClient = useQueryClient();
  const query = {
    mutationFn: updateConfig,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["proposal"] });
    },
  };
  return useMutation(query);
};

/**
 * Hook that returns a useEffect to listen for NetworkChanged events
 *
 * When the configuration changes, it invalidates the config query and forces the router to
 * revalidate its data (executing the loaders again).
 */
const useNetworkChanges = () => {
  const queryClient = useQueryClient();
  const client = useInstallerClient();

  const updateDevices = useCallback(
    (func: (devices: Device[]) => Device[]) => {
      const devices: Device[] = queryClient.getQueryData(["network", "devices"]);
      if (!devices) return;

      const updatedDevices = func(devices);
      queryClient.setQueryData(["network", "devices"], updatedDevices);
    },
    [queryClient],
  );

  const updateConnectionState = useCallback(
    (id: string, state: string) => {
      const connections: Connection[] = queryClient.getQueryData(["network", "connections"]);
      if (!connections) return;

      const updatedConnections = connections.map((conn) => {
        if (conn.id === id) {
          const { id: _, ...nextConnection } = conn;
          nextConnection.state = state as ConnectionState;
          return new Connection(id, nextConnection);
        }
        return conn;
      });
      queryClient.setQueryData(["network", "connections"], updatedConnections);
    },
    [queryClient],
  );

  React.useEffect(() => {
    if (!client) return;

    return client.onEvent((event) => {
      if (event.type === "NetworkChange") {
        if (event.deviceAdded) {
          const newDevice = Device.fromApi(event.deviceAdded);
          updateDevices((devices) => [...devices, newDevice]);
        }

        if (event.deviceUpdated) {
          const [name, apiDevice] = event.deviceUpdated;
          const device = Device.fromApi(apiDevice);
          updateDevices((devices) =>
            devices.map((d) => {
              if (d.name === name) {
                return device;
              }

              return d;
            }),
          );
        }

        if (event.deviceRemoved) {
          updateDevices((devices) => devices.filter((d) => d !== event.deviceRemoved));
        }

        if (event.connectionStateChanged) {
          const { id, state } = event.connectionStateChanged;
          updateConnectionState(id, state);
        }
      }
    });
  }, [client, queryClient, updateDevices, updateConnectionState]);
};

const useConnection = (name: string) => {
  const { connections } = useNetworkProposal();
  const connection = connections.find((c) => c.id === name);

  return connection;
};

/**
 * Returns the general state of the network.
 */
const useNetworkState = (): NetworkGeneralState => {
  const { state } = useNetworkProposal();

  return state;
};

/**
 * Returns the network devices.
 */
const useNetworkDevices = (): Device[] => {
  const { devices } = useNetworkSystem();

  return devices;
};

/**
 * Returns the network connections.
 */
const useConnections = (): Connection[] => {
  const { connections } = useNetworkProposal();

  return connections;
};

/**
 * Return the list of Wi-Fi networks.
 */
const useWifiNetworks = () => {
  const knownSsids: string[] = [];

  const { devices, accessPoints } = useNetworkSystem();
  const connections = useConnections();

  return accessPoints
    .filter((ap: AccessPoint) => {
      // Do not include "duplicates"
      if (knownSsids.includes(ap.ssid)) return false;
      // Do not include networks without SSID
      if (!ap.ssid || ap.ssid.trim() === "") return false;

      knownSsids.push(ap.ssid);
      return true;
    })
    .sort((a: AccessPoint, b: AccessPoint) => b.strength - a.strength)
    .map((ap: AccessPoint): WifiNetwork => {
      const settings = connections.find((c: Connection) => c.wireless?.ssid === ap.ssid);
      const device = devices.find((d: Device) => d.connection === settings?.id);

      let status: WifiNetworkStatus;
      if (device?.state === DeviceState.CONNECTED) {
        status = WifiNetworkStatus.CONNECTED;
      } else {
        status = settings ? WifiNetworkStatus.CONFIGURED : WifiNetworkStatus.NOT_CONFIGURED;
      }

      return {
        ...ap,
        settings,
        device,
        status,
      };
    });
};

export {
  useConnections,
  useConfigMutation,
  useConnection,
  useNetworkDevices,
  useNetworkState,
  useNetworkChanges,
  useWifiNetworks,
};
