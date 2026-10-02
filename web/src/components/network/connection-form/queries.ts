/*
 * Copyright (c) [2026] SUSE LLC
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

/**
 * Query hooks for the connection form.
 *
 * These compose route params with the network config and system queries to
 * derive the data the form needs. They feed both the form's default values and
 * field options, so they live in one place to avoid duplication.
 */

import { useParams } from "react-router";
import { useConfig } from "~/hooks/model/config/network";
import { useSystem, useDevices } from "~/hooks/model/system/network";
import { extendCollection } from "~/utils";

import { flattenConnections, isPort } from "~/types/network";

import type { Connection, Device } from "~/types/network";

/**
 * System connections available to the form, excluding removed ones and
 * including the ports nested in bonds and bridges.
 *
 * Used to generate non-colliding names for new connections.
 */
export function useSystemConnections(): Connection[] {
  const { connections = [] } = useSystem();
  return flattenConnections(connections).filter((c) => c.status !== "removed");
}

/**
 * Returns the connection being edited, or null when creating a new one.
 *
 * The route `id` param holds the connection id. Config and system connections
 * are merged so the form reflects the user's explicit settings (config) while
 * filling gaps from the live system state.
 *
 * Config wins for single values: e.g. configConn.method4 === undefined (the
 * user chose "Automatic", meaning "do not put method in the config") must
 * override systemConn.method4 === "auto" that the Agama backend or
 * NetworkManager might report.
 *
 * Arrays (addresses, nameservers, etc.) are concatenated so users can see
 * existing system values even when config has empty arrays.
 *
 * Removed connections are filtered out before merging to avoid carrying over
 * stale entries that may still exist in persisted config or system state.
 *
 * Both sides are flattened first, so a port nested in a bond or a bridge can be
 * edited like any other connection.
 */
export function useInitialConnection(): Connection | null {
  const { id } = useParams();
  const { connections: configConns = [] } = useConfig();
  const systemConns = useSystemConnections();

  const { all: connections } = extendCollection(
    flattenConnections(configConns).filter((c) => c.status !== "removed"),
    { with: systemConns, mergeArrays: true },
  );

  return connections.find((c) => c.id === id) ?? null;
}

/**
 * Whether the connection being edited is a port of a bond or a bridge.
 *
 * The config decides for a connection it knows about, since a port may have
 * been moved out of its controller or into another one there. The system
 * decides otherwise.
 */
export function useIsPort(): boolean {
  const { id } = useParams();
  const { connections: configConns = [] } = useConfig();
  const systemConns = useSystemConnections();
  const connection = useInitialConnection();
  if (!id || !connection) return false;

  const known = flattenConnections(configConns).some((c) => c.id === id);
  return isPort(known ? configConns : systemConns, connection);
}

/**
 * Query data frozen on mount to protect the form from mid-interaction
 * refetches.
 *
 * @see withFrozenQuery
 */
export type ConnectionFormContentQuery = {
  initialConnection: Connection | null;
  isPort: boolean;
  devices: Device[];
  systemConnections: Connection[];
};

/**
 * Aggregates the query hooks whose data feeds the form's defaultValues and
 * field options. Called at the wrapper level by withFrozenQuery.
 */
export function useConnectionFormContentQuery(): ConnectionFormContentQuery {
  return {
    initialConnection: useInitialConnection(),
    isPort: useIsPort(),
    devices: useDevices(),
    systemConnections: useSystemConnections(),
  };
}
