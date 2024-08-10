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

import React from "react";
import {
  useQueryClient,
  useMutation,
  useSuspenseQuery,
  useSuspenseQueries,
  useQuery,
} from "@tanstack/react-query";
import { useInstallerClient } from "~/context/installer";
import { _ } from "~/i18n";
import {
  AccessPoint,
  Connection,
  ConnectionApi,
  Device,
  DeviceApi,
  DeviceState,
  IPAddress,
  Route,
  RouteApi,
  WifiNetwork,
  WifiNetworkStatus,
} from "~/types/network";
import { formatIp, ipPrefixFor, securityFromFlags } from "~/utils/network";
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

const buildAddress = (address: string): IPAddress => {
  const [ip, netmask] = address.split("/");
  const result: IPAddress = { address: ip };
  if (netmask) result.prefix = ipPrefixFor(netmask);
  return result;
};

const buildAddresses = (rawAddresses?: string[]): IPAddress[] =>
  rawAddresses?.map(buildAddress) || [];

const buildRoutes = (rawRoutes?: RouteApi[]): Route[] => {
  if (!rawRoutes) return [];

  return rawRoutes.map((route) => ({ ...route, destination: buildAddress(route.destination) }));
};
/**
 * Returns the device settings
 */
const fromApiDevice = (device: DeviceApi): Device => {
  const { ipConfig, stateReason, ...newDevice } = device;
  // FIXME: Actually, would be better to have a Device class too in types and
  // move all of this logic to it.
  return {
    ...newDevice,
    nameservers: ipConfig?.nameservers || [],
    addresses: buildAddresses(ipConfig?.addresses),
    routes4: buildRoutes(ipConfig?.routes4),
    routes6: buildRoutes(ipConfig?.routes6),
    method4: ipConfig?.method4,
    method6: ipConfig?.method6,
    gateway4: ipConfig?.gateway4,
    gateway6: ipConfig?.gateway6,
  };
};

const fromApiConnection = (connection: ConnectionApi): Connection => {
  const { id, interface: iface, ...options } = connection;
  const nameservers = connection.nameservers || [];
  const addresses = connection.addresses?.map(buildAddress) || [];
  return new Connection(id, { ...options, iface, addresses, nameservers });
};

const toApiConnection = (connection: Connection): ConnectionApi => {
  const { iface, addresses, ...newConnection } = connection;
  const result: ConnectionApi = {
    ...newConnection,
    interface: iface,
    addresses: addresses?.map(formatIp) || [],
  };

  if (result.gateway4 === "") delete result.gateway4;
  if (result.gateway6 === "") delete result.gateway6;

  return result;
};

/**
 * Returns a query for retrieving the network configuration
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
    return devices.map(fromApiDevice);
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
    return fromApiConnection(connection);
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
    return connections.map(fromApiConnection);
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
    return accessPoints
      .map((ap) => {
        return {
          ssid: ap.ssid,
          hwAddress: ap.hwAddress,
          strength: ap.strength,
          security: securityFromFlags(ap.flags, ap.wpaFlags, ap.rsnFlags),
        };
      })
      .sort((a, b) => (a.strength < b.strength ? -1 : 1));
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
      addConnection(toApiConnection(newConnection))
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
      updateConnection(toApiConnection(newConnection))
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
  // queryKey: ["network", "wifi", "selected"],
  // TODO: use right key, once we stop invalidating everything under network
  queryKey: ["wifi", "selected"],
  queryFn: async () => {
    return Promise.resolve({ ssid: null, needsAuth: null });
  },
  staleTime: Infinity,
});

const useSelectedWifi = () => {
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

    return client.ws().onEvent((event) => {
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

const useConnection = (name) => {
  const { data } = useSuspenseQuery(connectionQuery(name));
  return data;
};

const useNetwork = () => {
  const [{ data: state }, { data: devices }, { data: connections }, { data: accessPoints }] =
    useSuspenseQueries({
      queries: [stateQuery(), devicesQuery(), connectionsQuery(), accessPointsQuery()],
    });

  return { connections, settings: state, devices, accessPoints };
};

const useWifiNetworks = () => {
  const knownSsids: string[] = [];
  const [{ data: devices }, { data: connections }, { data: accessPoints }] = useSuspenseQueries({
    queries: [devicesQuery(), connectionsQuery(), accessPointsQuery()],
  });

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
      const status = device
        ? WifiNetworkStatus.CONNECTED
        : settings
          ? WifiNetworkStatus.CONFIGURED
          : WifiNetworkStatus.NOT_CONFIGURED;

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
  useConnectionMutation,
  useRemoveConnectionMutation,
  useConnection,
  useNetwork,
  useSelectedWifi,
  useSelectedWifiChange,
  useNetworkConfigChanges,
  useWifiNetworks,
};
