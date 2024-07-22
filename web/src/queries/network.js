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
import { useQueryClient, useMutation, useSuspenseQuery, useSuspenseQueries } from "@tanstack/react-query";
import { useInstallerClient } from "~/context/installer";
import { DeviceState, createAccessPoint, securityFromFlags } from "~/client/network/model";
import { ipPrefixFor } from "~/client/network/utils";
/**
   * Returns the device settings
   *
   * @param {object} device - device settings from the API server
   * @return {Device}
   */
const fromApiDevice = (device) => {
  const nameservers = (device?.ipConfig?.nameservers || []);
  const { ipConfig = {}, ...dev } = device;
  const routes4 = (ipConfig.routes4 || []).map((route) => {
    const [ip, netmask] = route.destination.split("/");
    const destination = (netmask !== undefined) ? { address: ip, prefix: ipPrefixFor(netmask) } : { address: ip };

    return { ...route, destination };
  });

  const routes6 = (ipConfig.routes6 || []).map((route) => {
    const [ip, netmask] = route.destination.split("/");
    const destination = (netmask !== undefined) ? { address: ip, prefix: ipPrefixFor(netmask) } : { address: ip };

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

const fromApiConnection = (connection) => {
  const nameservers = (connection.nameservers || []);
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
  staleTime: Infinity
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
  staleTime: Infinity
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
        security: securityFromFlags(ap.flags, ap.wpaFlags, ap.rsnFlags)
      });
    });
    return access_points.sort((a, b) => (a.strength < b.strength) ? -1 : 1);
  },
  staleTime: Infinity
});

/**
 * Hook that builds a mutation to update a network connections
 *
 * It does not require to call `useMutation`.
 */
const useConnectionMutation = () => {
  const query = {
    mutationFn: (newConnection) =>
      fetch(`/api/network/connection/${newConnection.id}`, {
        method: "PUT",
        body: JSON.stringify(newConnection),
        headers: {
          "Content-Type": "application/json",
        },
      })
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
  staleTime: Infinity
});

const useSelectedWifi = () => {
  // TODO: evaluate if useSuspenseQuery is really needed, probably not.
  return useSuspenseQuery(selectedWiFiNetworkQuery());
}

const useSelectedWifiChange = () => {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async (data) => Promise.resolve(data),
    onSuccess: (data) => {
      queryClient.setQueryData(["wifi", "selected"], (prev) => ({ ...prev, ...data }));
    }
  });

  return mutation;
}

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

const useNetwork = () => {
  const [
    { data: state },
    { data: devices },
    { data: connections },
    { data: accessPoints }
  ] = useSuspenseQueries({
    queries: [
      stateQuery(),
      devicesQuery(),
      connectionsQuery(),
      accessPointsQuery()
    ]
  });
  const client = useInstallerClient();
  const networks = client.network.loadNetworks(devices, connections, accessPoints);

  return { connections, settings: state, devices, accessPoints, networks };
};


export {
  stateQuery,
  devicesQuery,
  connectionsQuery,
  accessPointsQuery,
  selectedWiFiNetworkQuery,
  useConnectionMutation,
  useNetwork,
  useSelectedWifi,
  useSelectedWifiChange,
  useNetworkConfigChanges
};
