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
import { useQueryClient, useMutation, useSuspenseQuery } from "@tanstack/react-query";
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
import {
  addConnection,
  applyChanges,
  deleteConnection,
  fetchAccessPoints,
  fetchConnection,
  fetchConnections,
  fetchDevices,
  fetchState,
  persist,
  updateConnection,
} from "~/api/network";
import { useNetworkProposal } from "./proposal";
import { useNetworkSystem } from "./system";

/**
 * Returns a query for retrieving the general network configuration
 */
const stateQuery = () => {
  return {
    queryKey: ["network", "state"],
    queryFn: fetchState,
  };
};

/**
 * Returns a query for retrieving the list of known devices
 */
const devicesQuery = () => ({
  queryKey: ["network", "devices"],
  queryFn: async () => {
    const devices = await fetchDevices();
    return devices.map(Device.fromApi);
  },
  staleTime: Infinity,
});

/**
 * Returns a query for retrieving data for the given connection name
 */
const connectionQuery = (name: string) => ({
  queryKey: ["network", "connections", name],
  queryFn: async () => {
    const connection = await fetchConnection(name);
    return Connection.fromApi(connection);
  },
  staleTime: Infinity,
});

/**
 * Returns a query for retrieving the list of known connections
 */
const connectionsQuery = () => ({
  queryKey: ["network", "connections"],
  queryFn: async () => {
    const connections = await fetchConnections();
    return connections.map(Connection.fromApi);
  },
  staleTime: Infinity,
});

/**
 * Returns a query for retrieving the list of known access points sortered by
 * the signal strength.
 */
const accessPointsQuery = () => ({
  queryKey: ["network", "accessPoints"],
  queryFn: async (): Promise<AccessPoint[]> => {
    const accessPoints = await fetchAccessPoints();
    return accessPoints.map(AccessPoint.fromApi).sort((a, b) => b.strength - a.strength);
  },
  // FIXME: Infinity vs 1second
  staleTime: 1000,
});

/**
 * Hook that builds a mutation to add a new network connection
 *
 * It does not require to call `useMutation`.
 */
const useAddConnectionMutation = () => {
  const queryClient = useQueryClient();
  const query = {
    mutationFn: (newConnection: Connection) =>
      addConnection(newConnection.toApi()).then(() => applyChanges()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["network", "connections"] });
      queryClient.invalidateQueries({ queryKey: ["network", "devices"] });
      queryClient.invalidateQueries({ queryKey: ["network", "accessPoints"] });
    },
  };
  return useMutation(query);
};

/**
 * Hook that builds a mutation to update a network connection
 *
 * It does not require to call `useMutation`.
 */
const useConnectionMutation = () => {
  const queryClient = useQueryClient();
  const query = {
    mutationFn: updateConnection,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["network", "connections"] });
      queryClient.invalidateQueries({ queryKey: ["network", "devices"] });
    },
  };
  return useMutation(query);
};

/**
 * Hook that provides a mutation for toggling the "persistent" state of a network
 * connection.
 *
 * This hook uses optimistic updates to immediately reflect the change in the UI
 * before the mutation completes. If the mutation fails, it will rollback to the
 * previous state.
 */
const useConnectionPersistMutation = () => {
  const queryClient = useQueryClient();
  const query = {
    mutationFn: (connection: Connection) => {
      return persist(connection.id, !connection.persistent);
    },
    onMutate: async (connection: Connection) => {
      // Get the current list of cached connections
      const previousConnections: Connection[] = queryClient.getQueryData([
        "network",
        "connections",
      ]);

      // Optimistically toggle the 'persistent' status of the matching connection
      const updatedConnections = previousConnections.map((cachedConnection) => {
        if (connection.id !== cachedConnection.id) return cachedConnection;

        const { id, ...nextConnection } = cachedConnection;
        return new Connection(id, { ...nextConnection, persistent: !cachedConnection.persistent });
      });

      // Update the cached data with the optimistically updated connections
      queryClient.setQueryData(["network", "connections"], updatedConnections);

      // Return the previous state for potential rollback
      return { previousConnections };
    },

    /**
     * Called if the mutation fails for whatever reason. Rolls back the cache to
     * the previous state.
     */
    onError: (_, connection: Connection, context: { previousConnections: Connection[] }) => {
      queryClient.setQueryData(["network", "connections"], context.previousConnections);
    },
  };

  return useMutation(query);
};
/**
 * Hook that builds a mutation to remove a network connection
 *
 * It does not require to call `useMutation`.
 */
const useRemoveConnectionMutation = () => {
  const queryClient = useQueryClient();
  const query = {
    mutationFn: (name: string) =>
      deleteConnection(name)
        .then(() => applyChanges())
        .catch((e) => console.log(e)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["network", "connections"] });
      queryClient.invalidateQueries({ queryKey: ["network", "devices"] });
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
  const { data } = useSuspenseQuery(stateQuery());
  return data;
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

  const devices = useNetworkDevices();
  const connections = useConnections();
  const { data: accessPoints } = useSuspenseQuery(accessPointsQuery());

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
  stateQuery,
  devicesQuery,
  connectionQuery,
  connectionsQuery,
  accessPointsQuery,
  useAddConnectionMutation,
  useConnections,
  useConnectionMutation,
  useConnectionPersistMutation,
  useRemoveConnectionMutation,
  useConnection,
  useNetworkDevices,
  useNetworkState,
  useNetworkChanges,
  useWifiNetworks,
};
