/*
 * Copyright (c) [2025-2026] SUSE LLC
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

import { useSuspenseQuery, useQueryClient } from "@tanstack/react-query";
import { System } from "~/model/system";
import { systemQuery } from "~/hooks/model/system";
import {
  AccessPoint,
  Connection,
  NetworkSystem,
  Device,
  GeneralState,
  WifiNetworkStatus,
  DeviceState,
  WifiNetwork,
  ConnectionState,
  IPAddress,
  ConnectionMethod,
} from "~/types/network";
import { useInstallerClient } from "~/context/installer";
import React, { useCallback } from "react";
import { formatIp } from "~/utils/network";
import { isEmpty } from "radashi";

const selectSystem = (data: System | null): NetworkSystem =>
  data ? NetworkSystem.fromApi(data.network) : null;

function useSystem(): NetworkSystem {
  const { data } = useSuspenseQuery({
    ...systemQuery,
    select: selectSystem,
  });

  return data;
}

/**
 * Returns the network connections.
 */
const useConnections = (): Connection[] => {
  const { connections } = useSystem();

  return connections;
};

/**
 * Returns the network devices.
 */
const useDevices = (): Device[] => {
  const { devices } = useSystem();

  return devices;
};

/**
 * Returns the network devices.
 */
const useState = (): GeneralState => {
  const { state } = useSystem();

  return state;
};

/**
 * Return the list of Wi-Fi networks.
 */
const useWifiNetworks = () => {
  const knownSsids: string[] = [];

  const { devices, connections, accessPoints } = useSystem();

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

/**
 * Options to influence returned value by useIpAddresses
 */
type UseIpAddressesOptions = {
  /**
   * Whether format IPs as string or not. When true, returns IP addresses as
   * formatted strings without prefix. If false or omitted, returns raw
   * IPAddress objects.
   */
  formatted?: boolean;
};

/**
 * Retrieves all IP addresses from devices associated with active connections.
 *
 * It filters devices to only include those linked to existing connections, then
 * extracts and flattens all IP addresses from those devices.
 */
function useIpAddresses(options: { formatted: true }): string[];
function useIpAddresses(options?: { formatted?: false }): IPAddress[];
function useIpAddresses(options: UseIpAddressesOptions = {}): string[] | IPAddress[] {
  const devices = useDevices();
  const connections = useConnections();
  const connectionsIds = connections.map((c) => c.id);
  const filteredDevices = devices.filter((d) => connectionsIds.includes(d.connection));

  if (options.formatted) {
    return filteredDevices.flatMap((d) =>
      d.addresses.map((a) => formatIp(a, { removePrefix: true })),
    );
  }

  return filteredDevices.flatMap((d) => d.addresses);
}

/**
 * Network status constants
 */
export const NetworkStatus = {
  MANUAL: "manual",
  AUTO: "auto",
  MIXED: "mixed",
  NOT_CONFIGURED: "not_configured",
  NO_PERSISTENT: "no_persistent",
};

type NetworkStatusType = (typeof NetworkStatus)[keyof typeof NetworkStatus];

/**
 * Options for useNetworkStatus hook
 */
export type NetworkStatusOptions = {
  /** If true, uses also non-persistent connections to determine the network
   * configuration status */
  includeNonPersistent?: boolean;
};

/**
 * @internal
 *
 * Determines the global network configuration status.
 *
 * @note
 *
 * This is actually the implementation of {@link useNetworkStatus}
 *
 * @note
 *
 * Exported for testing purposes only. Since useNetworkStatus and useConnections
 * live in the same module, mocking useConnections doesn't work because internal
 * calls within a module bypass mocks.
 *
 * Rather than split hooks into multiple files or mock React Query internals
 * (both worse trade-offs), the main logic was extracted as a pure function for
 * direct testing. Given the complexity and importance of this network status
 * logic, leaving it untested was not an acceptable option.
 *
 * If a better approach is found, this can be moved back into
 * the hook.
 */
const getNetworkStatus = (
  connections: Connection[],
  { includeNonPersistent = false }: NetworkStatusOptions = {},
) => {
  const persistentConnections = connections.filter((c) => c.persistent);

  // Filter connections based on includeNonPersistent option
  const connectionsToCheck = includeNonPersistent ? connections : persistentConnections;

  let status: NetworkStatusType;

  if (isEmpty(connections)) {
    status = NetworkStatus.NOT_CONFIGURED;
  } else if (!includeNonPersistent && isEmpty(connectionsToCheck)) {
    status = NetworkStatus.NO_PERSISTENT;
  } else {
    const someManual = connectionsToCheck.some(
      (c) =>
        c.method4 === ConnectionMethod.MANUAL ||
        c.method6 === ConnectionMethod.MANUAL ||
        !isEmpty(c.addresses),
    );

    const someAuto = connectionsToCheck.some(
      (c) => c.method4 === ConnectionMethod.AUTO || c.method6 === ConnectionMethod.AUTO,
    );

    if (someManual && someAuto) {
      status = NetworkStatus.MIXED;
    } else if (someAuto) {
      status = NetworkStatus.AUTO;
    } else {
      status = NetworkStatus.MANUAL;
    }
  }

  return {
    status,
    connections,
    persistentConnections,
  };
};

/**
 * Determines the global network configuration status.
 *
 * Returns the network status, the full collection of connections (both
 * persistent and non-persistent), and a filtered list of only persistent
 * connections.
 *
 * The `status` reflects the network configuration, depending on the state of
 * connections (whether there are connections, and whether some are persistent)
 * and the so called network mode (manual, auto, mixed)
 *   - If there are no connections, the status will be `NetworkStatus.NOT_CONFIGURED`.
 *   - If there are no persistent connections and `includeNonPersistent` is false
 *     (the default), the status will be `NetworkStatus.NO_PERSISTENT`.
 *   - When `includeNonPersistent` is true, non-persistent connections are
 *     included in the mode calculation, and the **NO_PERSISTENT** status is ignored.
 *   - When at least one connection has defined at least one static IP, the
 *     status will be either, manual or mixed depending in the connection.method4
 *     and connection.method6 value
 *
 *
 * @see {@link getNetworkStatus} for implementation details and why the logic
 * was extracted.
 */
const useNetworkStatus = ({ includeNonPersistent = false }: NetworkStatusOptions = {}) => {
  const connections = useConnections();
  return getNetworkStatus(connections, { includeNonPersistent });
};

/**
 * FIXME: ADAPT to the new config HTTP API
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

export {
  useConnections,
  useDevices,
  useNetworkChanges,
  useNetworkStatus,
  useSystem,
  useIpAddresses,
  useWifiNetworks,
  useState,
  getNetworkStatus,
};
