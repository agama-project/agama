/*
 * Copyright (c) [2023-2026] SUSE LLC
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

import React, { useReducer } from "react";
import { isEmpty } from "radashi";
import { sprintf } from "sprintf-js";
import {
  Button,
  Content,
  EmptyState,
  EmptyStateActions,
  EmptyStateBody,
  EmptyStateFooter,
  Toolbar,
  ToolbarContent,
  ToolbarGroup,
  ToolbarItem,
} from "@patternfly/react-core";
import Icon from "~/components/layout/Icon";
import Text from "~/components/core/Text";
import SelectableDataTable, { SortedBy } from "~/components/core/SelectableDataTable";
import TextinputFilter from "~/components/storage/dasd/TextinputFilter";
import SimpleSelector from "~/components/core/SimpleSelector";
import { useConnections, useConnectionMutation } from "~/hooks/model/config/network";
import { sortCollection, translateEntries } from "~/utils";
import { _, N_ } from "~/i18n";
import { Connection, ConnectionStatus, Device, DeviceState } from "~/types/network";

/**
 * Filter options for narrowing down network devices shown in the table.
 *
 * All filters are optional and may be combined.
 */
type DevicesFilters = {
  name?: Device["name"];
  type?: "all" | Device["type"];
  state?: "all" | Device["state"];
};

/**
 * Predicate function for evaluating whether a device meets a given
 * condition.
 *
 * Used internally to compose filter logic when narrowing down the list of
 * devices shown in the network table.
 */
type DeviceCondition = (device: Device) => boolean;

/**
 * Props shared by `buildActions`.
 *
 * Covers single-device row actions.
 */
type ActionsProps = {
  /** Device to act on. */
  device: Device;
  /**
   * Persists device config changes to the backend.
   */

  // FIXME: It should create a new connection with DHCP from the device (quick action)
  // addOrUpdateDevices: ReturnType<typeof useAddOrUpdateDevices>;
  onConnectNetworkDevice: (device: Device) => void;
  onDisconnectNetworkDevice: (device: Device) => void;
  onRemoveNetworkConnection: (device: Device) => void;
  hasConnection: boolean;
};

/**
 * Possible network devices states.
 *
 * Values use `N_()` for translation extraction. Translate with `_()` at render time.
 *
 * @example
 * ```ts
 * const statusLabel = _(STATE_OPTIONS[device.status]);
 * ```
 */
const STATE_OPTIONS = {
  unknown: N_("Unknown"),
  unmanaged: N_("Unmanaged"),
  unavailable: N_("Unavailable"),
  connecting: N_("Connecting"),
  connected: N_("Connected"),
  disconnecting: N_("Disconnecting"),
  failed: N_("Failed"),
  disconnected: N_("Disconnected"),
};

const TYPE_OPTIONS = {
  ethernet: N_("Ethernet"),
  bond: N_("Bond"),
  bridge: N_("Bridge"),
  vlan: N_("Vlan"),
  wireless: N_("Wireless"),
};

/**
 * Filters an array of devices based on given filters.
 *
 * @param devices - The array of network Device objects to filter.
 * @param filters - The filters to apply.
 * @returns The filtered array of network Device objects matching all conditions.
 */
const filterDevices = (devices: Device[], filters: DevicesFilters): Device[] => {
  const { name, type, state } = filters;

  const conditions: DeviceCondition[] = [];

  if (!isEmpty(name)) {
    conditions.push((d) => d.name.toLowerCase().includes(name.toLowerCase()));
  }

  if (state && state !== "all") {
    conditions.push((d) => d.state === state);
  }

  if (type && type !== "all") {
    conditions.push((d) => d.type === type);
  }

  return devices.filter((device) => conditions.every((conditionFn) => conditionFn(device)));
};

/**
 * Builds the list of actions available for the given device
 */
const buildActions = ({
  device,
  onConnectNetworkDevice,
  onDisconnectNetworkDevice,
  onRemoveNetworkConnection,
  hasConnection,
}: ActionsProps) => {
  const actions = [
    {
      id: "connect",
      title: _("Connect"),
      onClick: () => onConnectNetworkDevice(device),
    },
    {
      id: "disconnect",
      title: _("Disconnect"),
      onClick: () => onDisconnectNetworkDevice(device),
    },
    {
      id: "remove",
      title: _("Remove connection"),
      onClick: () => onRemoveNetworkConnection(device),
    },
  ];

  const keptActions = {
    connect: [DeviceState.DISCONNECTED, DeviceState.FAILED].includes(device.state),
    disconnect: [DeviceState.CONNECTED, DeviceState.CONNECTING].includes(device.state),
    remove: hasConnection,
  };
  return actions.filter((a) => keptActions[a.id]);
};

/** Props for `FiltersToolbar`. */
type FiltersToolbarProps = {
  /** Currently active filter values. */
  filters: DevicesFilters;
  /**
   * Unique statuses present in the current device list, used to restrict the
   * status filter to only relevant options. Does not include the synthetic "all"
   * option.
   */
  availableStates: Device["state"][];
  /** Whether any filter differs from its default value. */
  hasActiveFilters: boolean;
  /** Total number of devices before filtering. */
  totalDevices: number;
  /** Number of devices that pass the current filters. */
  matchingDevices: number;
  /** Callback invoked when a single filter value changes. */
  onFilterChange: (filter: keyof DevicesFilters, value: string | number) => void;
  /** Callback invoked when all filters should be reset to their defaults. */
  onReset: () => void;
};

/**
 * Renders the filter controls toolbar for the network devices table.
 *
 * Displays state and type filters alongside a device count
 * summary. When any filter is active the count switches from "N devices
 * available" to "M of N devices match filters" and a "Clear all filters" link
 * appears.
 */
const FiltersToolbar = ({
  filters,
  availableStates,
  hasActiveFilters,
  totalDevices,
  matchingDevices,
  onFilterChange,
  onReset,
}: FiltersToolbarProps) => {
  const countText = hasActiveFilters
    ? sprintf(
        // TRANSLATORS: shown in the filter toolbar when filters are active.
        // %1$s is the number of matching devices, %2$s is the total number.
        _("%1$d of %2$d devices match filters"),
        matchingDevices,
        totalDevices,
      )
    : sprintf(
        // TRANSLATORS: shown in the filter toolbar when no filters are active.
        // %s is the total number of devices.
        _("%d devices available"),
        totalDevices,
      );

  return (
    <Toolbar>
      <ToolbarContent alignItems="center">
        <ToolbarGroup>
          <ToolbarItem>
            <TextinputFilter
              id="device-name"
              label={_("Name")}
              value={filters.name}
              width="120px"
              onChange={(_, v) => onFilterChange("name", v)}
            />
          </ToolbarItem>
          <ToolbarItem>
            <SimpleSelector
              label={_("State")}
              value={filters.state}
              options={{
                all: _("All"),
                ...translateEntries(STATE_OPTIONS, {
                  filter: (k: DeviceState) => availableStates.includes(k),
                }),
              }}
              onChange={(_, v) => onFilterChange("state", v)}
            />
          </ToolbarItem>
          <ToolbarItem>
            <SimpleSelector
              label={_("Type")}
              value={filters.type}
              options={{
                all: _("All"),
                ...translateEntries(TYPE_OPTIONS),
              }}
              onChange={(_, v) => onFilterChange("type", v)}
            />
          </ToolbarItem>
        </ToolbarGroup>
        <ToolbarGroup align={{ default: "alignEnd" }}>
          <ToolbarItem>
            <Text textStyle="textColorSubtle">{countText}</Text>
          </ToolbarItem>
          {hasActiveFilters && (
            <ToolbarItem>
              <Button variant="link" isInline onClick={onReset}>
                {_("Clear all filters")}
              </Button>
            </ToolbarItem>
          )}
        </ToolbarGroup>
      </ToolbarContent>
    </Toolbar>
  );
};

/** Internal state shape for the network table component. */
type TableState = {
  /** Current sorting state */
  sortedBy: SortedBy;
  /** Current active filters applied to the device list */
  filters: DevicesFilters;
};

/**
 * Initial state for `reducer`.
 *
 * @remarks
 * Also serves as the canonical "no filters active" reference: filter changes
 * are detected by comparing the current filters against this object via
 * `JSON.stringify`.
 */
const initialState: TableState = {
  sortedBy: { index: 0, direction: "asc" },
  filters: {
    name: "",
    state: "all",
    type: "all",
  },
};

/**
 * Union of all actions that can be dispatched to update the network table state.
 **/
type TableAction =
  | { type: "UPDATE_SORTING"; payload: TableState["sortedBy"] }
  | { type: "UPDATE_FILTERS"; payload: TableState["filters"] }
  | { type: "RESET_FILTERS" };

/**
 * Reducer for the network table.
 *
 * Handles all state transitions driven by `TableAction` dispatches.
 */
const reducer = (state: TableState, action: TableAction): TableState => {
  switch (action.type) {
    case "UPDATE_SORTING": {
      return { ...state, sortedBy: action.payload };
    }

    case "UPDATE_FILTERS": {
      return { ...state, filters: { ...state.filters, ...action.payload } };
    }

    case "RESET_FILTERS": {
      return { ...state, filters: initialState.filters };
    }
  }
};

/**
 * Column definitions for the network devices table.
 *
 * Each entry defines the column header label, how its value is derived from a
 * `Device`, and which field drives sorting. Consumed by `SelectableDataTable`.
 */
const createColumns = () => [
  {
    // TRANSLATORS: table header for a network devices table
    name: _("Name"),
    value: (d: Device) => d.name,
    sortingKey: (d: Device) => d.name,
  },
  {
    // TRANSLATORS: table header for a network devices table
    name: _("State"),
    value: (d: Device) => STATE_OPTIONS[d.state],
    sortingKey: "state",
  },
  {
    // TRANSLATORS: table header for a network devices table
    name: _("Connection"),
    value: (d: Device) => d.connection || "-",
    sortingKey: "connection",
  },
  {
    // TRANSLATORS: table header for a network devices table
    name: _("Type"),
    value: (d: Device) => d.type,
    sortingKey: "type",
  },
];

type DevicesTableProps = {
  devices: Device[];
};

/**
 * Renders a network devices table.
 */
export default function DevicesTable({ devices }: DevicesTableProps) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const connections = useConnections();
  const { mutateAsync: mutateConnection } = useConnectionMutation();

  const connectNetworkDevice = (device: Device) => {
    const existing = connections.find((c) => c.id === device.connection || c.iface === device.name);
    const connection = existing
      ? new Connection(existing.id, { ...existing, status: ConnectionStatus.UP })
      : new Connection(device.name, { iface: device.name, status: ConnectionStatus.UP });

    mutateConnection(connection);
  };

  const disconnectNetworkDevice = (device: Device) => {
    const existing = connections.find((c) => c.id === device.connection || c.iface === device.name);

    if (existing) {
      const connection = new Connection(existing.id, {
        ...existing,
        status: ConnectionStatus.DOWN,
      });
      mutateConnection(connection);
    }
  };

  const removeNetworkConnection = (device: Device) => {
    const existing = connections.find((c) => c.id === device.connection || c.iface === device.name);

    if (existing) {
      const connection = new Connection(existing.id, {
        ...existing,
        status: ConnectionStatus.DELETE,
      });
      mutateConnection(connection);
    }
  };

  const columns = createColumns();

  const onSortingChange = (sortedBy: SortedBy) => {
    dispatch({ type: "UPDATE_SORTING", payload: sortedBy });
  };

  const onFilterChange = (filter: keyof DevicesFilters, value) => {
    dispatch({ type: "UPDATE_FILTERS", payload: { [filter]: value } });
  };

  const resetFilters = () => dispatch({ type: "RESET_FILTERS" });

  // Filtering
  const filteredDevices = filterDevices(devices, state.filters);

  // Sorting
  const sortingKey = columns[state.sortedBy.index].sortingKey;
  const sortedDevices = sortCollection(filteredDevices, state.sortedBy.direction, sortingKey);

  const availableStates = [...new Set(devices.map((d: Device) => d.state))] as Device["state"][];

  return (
    <Content>
      <FiltersToolbar
        filters={state.filters}
        availableStates={availableStates}
        hasActiveFilters={JSON.stringify(state.filters) !== JSON.stringify(initialState.filters)}
        totalDevices={devices.length}
        matchingDevices={filteredDevices.length}
        onFilterChange={onFilterChange}
        onReset={resetFilters}
      />

      <SelectableDataTable
        columns={columns}
        items={sortedDevices}
        itemIdKey="name"
        selectionMode="none"
        variant="compact"
        sortedBy={state.sortedBy}
        updateSorting={onSortingChange}
        itemActions={(d: Device) =>
          buildActions({
            device: d,
            onConnectNetworkDevice: connectNetworkDevice,
            onDisconnectNetworkDevice: disconnectNetworkDevice,
            onRemoveNetworkConnection: removeNetworkConnection,
            hasConnection: !!(
              d.connection || connections.some((c) => c.iface === d.name || c.id === d.connection)
            ),
          })
        }
        itemActionsLabel={(d: Device) => `Actions for ${d.name}`}
        emptyState={
          <EmptyState
            headingLevel="h2"
            titleText={_("No devices match filters")}
            icon={() => <Icon name="search_off" />}
            variant="sm"
          >
            <EmptyStateBody>{_("Change filters and try again.")}</EmptyStateBody>
            <EmptyStateFooter>
              <EmptyStateActions>
                <Button variant="secondary" onClick={resetFilters}>
                  {_("Clear all filters")}
                </Button>
              </EmptyStateActions>
            </EmptyStateFooter>
          </EmptyState>
        }
      />
    </Content>
  );
}
