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

import React from "react";
import { useQueryClient, useMutation, useSuspenseQuery, useQuery } from "@tanstack/react-query";
import { useInstallerClient } from "~/context/installer";
import {
  AccessPoint,
  Connection,
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
  updateConnection,
} from "~/api/network";

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
 * Returns a query for retrieving data for the given conneciton name
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
 * Returns a query for retrieving the list of known access points
 */
const accessPointsQuery = () => ({
  queryKey: ["network", "accessPoints"],
  queryFn: async (): Promise<AccessPoint[]> => {
    const accessPoints = await fetchAccessPoints();
    return accessPoints.map(AccessPoint.fromApi).sort((a, b) => (a.strength < b.strength ? -1 : 1));
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
      addConnection(newConnection.toApi())
        .then(() => applyChanges())
        .catch((e) => console.log(e)),
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
    mutationFn: (newConnection: Connection) =>
      updateConnection(newConnection.toApi())
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
 * Returns selected Wi-Fi network
 */
const selectedWiFiNetworkQuery = () => ({
  // TODO: use right key, once we stop invalidating everything under network
  // queryKey: ["network", "wifi", "selected"],
  queryKey: ["wifi", "selected"],
  queryFn: async () => {
    return Promise.resolve({ ssid: null, needsAuth: null });
  },
  staleTime: Infinity,
});

const useSelectedWifi = (): { ssid?: string; needsAuth?: boolean; hidden?: boolean } => {
  const { data } = useQuery(selectedWiFiNetworkQuery());
  return data || {};
};

const useSelectedWifiChange = () => {
  type SelectedWifi = {
    ssid?: string;
    hidden?: boolean;
    needsAuth?: boolean;
  };

  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async (data: SelectedWifi): Promise<SelectedWifi> => Promise.resolve(data),
    onSuccess: (data: SelectedWifi) => {
      queryClient.setQueryData(["wifi", "selected"], (prev: SelectedWifi) => ({
        ssid: prev.ssid,
        ...data,
      }));
    },
  });

  return mutation;
};

/**
 * Hook that returns a useEffect to listen for NetworkChanged events
 *
 * When the configuration changes, it invalidates the config query and forces the router to
 * revalidate its data (executing the loaders again).
 */
const useNetworkConfigChanges = () => {
  const queryClient = useQueryClient();
  const client = useInstallerClient();
  const changeSelected = useSelectedWifiChange();

  React.useEffect(() => {
    if (!client) return;

    return client.onEvent((event) => {
      if (event.type === "NetworkChange") {
        if (event.deviceRemoved || event.deviceAdded) {
          queryClient.invalidateQueries({ queryKey: ["network"] });
        }

        if (event.deviceUpdated) {
          const [name, data] = event.deviceUpdated;
          const devices: Device[] = queryClient.getQueryData(["network", "devices"]);
          if (!devices) return;

          if (name !== data.name) {
            return queryClient.invalidateQueries({ queryKey: ["network"] });
          }

          const current_device = devices.find((d) => d.name === name);
          if (
            [DeviceState.DISCONNECTED, DeviceState.ACTIVATED, DeviceState.UNAVAILABLE].includes(
              data.state,
            )
          ) {
            if (current_device.state !== data.state) {
              queryClient.invalidateQueries({ queryKey: ["network"] });
              return changeSelected.mutate({ needsAuth: false });
            }
          }
          if ([DeviceState.NEEDAUTH, DeviceState.FAILED].includes(data.state)) {
            return changeSelected.mutate({ needsAuth: true });
          }
        }
      }
    });
  }, [client, queryClient, changeSelected]);
};

const useConnection = (name: string) => {
  const { data } = useSuspenseQuery(connectionQuery(name));
  return data;
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
  const { data } = useSuspenseQuery(devicesQuery());
  return data;
};

/**
 * Returns the network connections.
 */
const useConnections = (): Connection[] => {
  const { data } = useSuspenseQuery(connectionsQuery());
  return data;
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
      const device = devices.find((d: Device) => d.connection === ap.ssid);

      let status: WifiNetworkStatus;
      if (device?.state === DeviceState.ACTIVATED) {
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
  selectedWiFiNetworkQuery,
  useAddConnectionMutation,
  useConnections,
  useConnectionMutation,
  useRemoveConnectionMutation,
  useConnection,
  useNetworkDevices,
  useNetworkState,
  useSelectedWifi,
  useSelectedWifiChange,
  useNetworkConfigChanges,
  useWifiNetworks,
};
