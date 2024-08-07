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
} from "@tanstack/react-query";
import { useInstallerClient } from "~/context/installer";
import { createAccessPoint } from "~/client/network/model";
import { _ } from "~/i18n";
import {
  AccessPoint,
  Connection,
  ConnectionApi,
  ConnectionOptions,
  Device,
  DeviceState,
  WifiNetwork,
  WifiNetworkStatus,
} from "~/types/network";
import { formatIp, ipPrefixFor, securityFromFlags } from "~/utils/network";

/**
 * Returns the device settings
 */
const fromApiDevice = (device: object): Device => {
  const nameservers = device?.ipConfig?.nameservers || [];
  const { ipConfig = {}, ...dev } = device;
  const routes4 = (ipConfig.routes4 || []).map((route) => {
    const [ip, netmask] = route.destination.split("/");
    const destination =
      netmask !== undefined ? { address: ip, prefix: ipPrefixFor(netmask) } : { address: ip };

    return { ...route, destination };
  });

  const routes6 = (ipConfig.routes6 || []).map((route) => {
    const [ip, netmask] = route.destination.split("/");
    const destination =
      netmask !== undefined ? { address: ip, prefix: ipPrefixFor(netmask) } : { address: ip };

    return { ...route, destination };
  });

  const addresses = (ipConfig.addresses || []).map((address) => {
    const [ip, netmask] = address.split("/");
    if (netmask !== undefined) {
      return { address: ip, prefix: ipPrefixFor(netmask) };
    } else {
      return { address: ip };
    }
  });

  return { ...dev, ...ipConfig, addresses, nameservers, routes4, routes6 };
};

const fromApiConnection = (connection: ConnectionApi): Connection => {
  const nameservers = connection.nameservers || [];
  const addresses = (connection.addresses || []).map((address) => {
    const [ip, netmask] = address.split("/");
    if (netmask !== undefined) {
      return { address: ip, prefix: ipPrefixFor(netmask) };
    } else {
      return { address: ip };
    }
  });

  return { ...connection, addresses, nameservers };
};

const toApiConnection = (connection: Connection): ConnectionApi => {
  const addresses = (connection.addresses || []).map((addr) => formatIp(addr));
  const { iface, gateway4, gateway6, ...conn } = connection;

  if (gateway4?.trim() !== "") conn.gateway4 = gateway4;
  if (gateway6?.trim() !== "") conn.gateway6 = gateway6;

  return { ...conn, addresses, interface: iface };
};

const loadNetworks = (
  devices: Device[],
  connections: Connection[],
  accessPoints: AccessPoint[],
): WifiNetwork[] => {
  const knownSsids = [];

  return accessPoints
    .sort((a, b) => b.strength - a.strength)
    .map((ap) => {
      // Do not include networks without SSID
      if (!ap.ssid || ap.ssid === "") return null;
      // Do not include "duplicates"
      if (knownSsids.includes(ap.ssid)) return null;

      const settings = connections.find((c) => c.wireless?.ssid === ap.ssid);
      const device = devices.find((c) => c.connection === ap.ssid);
      const status = device
        ? WifiNetworkStatus.CONNECTED
        : settings
          ? WifiNetworkStatus.CONFIGURED
          : WifiNetworkStatus.NOT_CONFIGURED;

      const network = {
        ...ap,
        settings,
        device,
        status,
      };

      knownSsids.push(network.ssid);

      return network;
    });
};

/**
 * Returns a query for retrieving the network configuration
 */
const stateQuery = () => {
  return {
    queryKey: ["network", "state"],
    queryFn: () => fetch("/api/network/state").then((res) => res.json()),
  };
};

/**
 * Returns a query for retrieving the list of known devices
 */
const devicesQuery = () => ({
  queryKey: ["network", "devices"],
  queryFn: async () => {
    const response = await fetch("/api/network/devices");
    const devices = await response.json();

    return devices.map(fromApiDevice);
  },
  staleTime: Infinity,
});

/**
 * Returns a query for retrieving the list of known connections
 */
const connectionQuery = (name) => ({
  queryKey: ["network", "connections", name],
  queryFn: async () => {
    const response = await fetch(`/api/network/connections/${name}`);
    const connection = await response.json();
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
    const response = await fetch("/api/network/connections");
    const connections = await response.json();
    return connections.map(fromApiConnection);
  },
  staleTime: Infinity,
});

/**
 * Returns a query for retrieving the list of known access points
 */
const accessPointsQuery = () => ({
  queryKey: ["network", "accessPoints"],
  queryFn: async () => {
    const response = await fetch("/api/network/wifi");
    const json = await response.json();
    const access_points = json.map((ap) => {
      return createAccessPoint({
        ssid: ap.ssid,
        hwAddress: ap.hw_address,
        strength: ap.strength,
        security: securityFromFlags(ap.flags, ap.wpaFlags, ap.rsnFlags),
      });
    });
    return access_points.sort((a, b) => (a.strength < b.strength ? -1 : 1));
  },
  staleTime: Infinity,
});

/**
 * Hook that builds a mutation to add a new network connection
 *
 * It does not require to call `useMutation`.
 */
const useAddConnectionMutation = () => {
  const queryClient = useQueryClient();
  const query = {
    mutationFn: (newConnection) =>
      fetch("/api/network/connections", {
        method: "POST",
        body: JSON.stringify(toApiConnection(newConnection)),
        headers: {
          "Content-Type": "application/json",
        },
      }).then((response) => {
        if (response.ok) {
          return fetch(`/api/network/system/apply`, { method: "PUT" });
        } else {
          throw new Error(_("Please, try again"));
        }
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["network", "connections"] });
      queryClient.invalidateQueries({ queryKey: ["network", "devices"] });
      queryClient.invalidateQueries({ queryKey: ["network", "accessPoints"] });
    },
  };
  return useMutation(query);
};
/**
 * Hook that builds a mutation to update a network connections
 *
 * It does not require to call `useMutation`.
 */
const useConnectionMutation = () => {
  const queryClient = useQueryClient();
  const query = {
    mutationFn: (newConnection: Connection) =>
      fetch(`/api/network/connections/${newConnection.id}`, {
        method: "PUT",
        body: JSON.stringify(toApiConnection(newConnection)),
        headers: {
          "Content-Type": "application/json",
        },
      }).then((response) => {
        if (response.ok) {
          return fetch("/api/network/system/apply", { method: "PUT" });
        } else {
          throw new Error(_("Please, try again"));
        }
      }),
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
    mutationFn: (name) =>
      fetch(`/api/network/connections/${name}`, { method: "DELETE" }).then((response) => {
        if (response.ok) {
          return fetch(`/api/network/system/apply`, { method: "PUT" });
        } else {
          throw new Error(_("Please, try again"));
        }
      }),
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
  // TODO: evaluate if useSuspenseQuery is really needed, probably not.
  const { data } = useSuspenseQuery(selectedWiFiNetworkQuery());
  return data;
};

const useSelectedWifiChange = () => {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async (data: object): Promise<object> => Promise.resolve(data),
    onSuccess: (data: object) => {
      queryClient.setQueryData(["wifi", "selected"], (prev: object) => ({ ...prev, ...data }));
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
          const devices = queryClient.getQueryData(["network", "devices"]);
          if (!devices) return;

          if (name !== data.name) {
            return queryClient.invalidateQueries({ queryKey: ["network"] });
          }

          const current_device = devices.find((d) => d.name === name);
          if ([DeviceState.DISCONNECTED, DeviceState.ACTIVATED].includes(data.state)) {
            if (current_device.state !== data.state) {
              return queryClient.invalidateQueries({ queryKey: ["network"] });
            }
          }
          if (data.state === DeviceState.FAILED) {
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
    .sort((a: AccessPoint, b: AccessPoint) => b.strength - a.strength)
    .map((ap: AccessPoint) => {
      console.log("Access point: ", ap);
      // Do not include networks without SSID
      if (!ap.ssid || ap.ssid === "") return null;
      // Do not include "duplicates"
      if (knownSsids.includes(ap.ssid)) return null;

      const settings = connections.find((c: Connection) => c.wireless?.ssid === ap.ssid);
      const device = devices.find((d: Device) => d.connection === ap.ssid);
      const status = device
        ? WifiNetworkStatus.CONNECTED
        : settings
          ? WifiNetworkStatus.CONFIGURED
          : WifiNetworkStatus.NOT_CONFIGURED;

      const network = {
        ...ap,
        settings,
        device,
        status,
      };

      knownSsids.push(network.ssid);

      return network;
    }).filter((ap: AccessPoint) => ap != null);
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
