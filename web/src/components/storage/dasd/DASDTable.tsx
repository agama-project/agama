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

import React, { useEffect, useReducer } from "react";
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
import Popup from "~/components/core/Popup";
import FormatActionHandler from "~/components/storage/dasd/FormatActionHandler";
import FormatFilter from "~/components/storage/dasd/FormatFilter";
import SelectableDataTable, { SortedBy } from "~/components/core/SelectableDataTable";
import StatusFilter from "~/components/storage/dasd/StatusFilter";
import TextinputFilter from "~/components/storage/dasd/TextinputFilter";
import { isEmpty, omit } from "radashi";
import { sprintf } from "sprintf-js";
import { useInstallerClient } from "~/context/installer";
import { extendCollection, hex, sortCollection } from "~/utils";
import { _, n_ } from "~/i18n";

import type { Device as ConfigDevice } from "~/model/config/dasd";
import type { Device as SystemDevice } from "~/model/system/dasd";
import { IAction } from "@patternfly/react-table";

type MergedDevice = ConfigDevice & SystemDevice;

/**
 * Filter options for narrowing down DASD devices shown in the table.
 *
 * All filters are optional and may be combined.
 */
export type DASDDevicesFilters = {
  /** Lower bound for channel ID filtering (inclusive). */
  minChannel?: MergedDevice["channel"];
  /** Upper bound for channel ID filtering (inclusive). */
  maxChannel?: MergedDevice["channel"];
  /** Only show devices with this status (e.g. "active", "offline"). */
  state?: "all" | MergedDevice["state"];
  /** Filter by formatting status: "yes" (to be formatted), "no" (not to be formatted), or
   * "all" (all devices). */
  format?: "all" | "yes" | "no";
};

/**
 * Predicate function for evaluating whether a DASD device meets a given
 * condition.
 *
 * Used internally to compose filter logic when narrowing down the list of
 * devices shown in the DASD table.
 */
type DASDDeviceCondition = (device: MergedDevice) => boolean;

/**
 * Props required to generate bulk actions for selected DASD devices.
 */
type DASDActionsBuilderProps = {
  /** The list of selected DASD devices. */
  devices: MergedDevice[];
  /** Mutation function used to trigger backend updates (e.g. enable, disable). */
  updater: (options: unknown) => void; // FIXME: adapt former DASDMutationFn to its API v2 equivalent;
  /** State dispatcher for triggering actions */
  dispatcher: (props: DASDTableAction) => void;
};

/**
 * Filters an array of devices based on given filters.
 *
 * @param devices - The array of DASD Device objects to filter.
 * @param filters - The filters to apply.
 * @returns The filtered array of DASD Device objects matching all conditions.
 */
const filterDevices = (devices: MergedDevice[], filters: DASDDevicesFilters): Device[] => {
  const { minChannel, maxChannel, state, format } = filters;

  const conditions: DASDDeviceCondition[] = [];

  if (minChannel || maxChannel) {
    const allChannels = devices.map((d) => hex(d.channel)); // FIXME: review te hexId stuff..
    const min = hex(minChannel) || Math.min(...allChannels);
    const max = hex(maxChannel) || Math.max(...allChannels);

    conditions.push((d) => hex(d.channel) >= min && hex(d.channel) <= max);
  }

  if (state && state !== "all") {
    conditions.push((d) => d.state === state);
  }

  if (format === "yes" || format === "no") {
    conditions.push((d) => (format === "yes" ? d.format : !d.format));
  }

  return devices.filter((device) => conditions.every((conditionFn) => conditionFn(device)));
};

/**
 * Builds the list of available actions for given DASD devices.
 *
 * Returns an array of action objects, each with a label and an `onClick`
 * handler. Some actions mutate device state directly (via `updater`), while
 * others (like format) dispatch updates via `dispatcher`.
 */
const buildActions = ({ devices, updater, dispatcher }: DASDActionsBuilderProps) => {
  const ids = devices.map((d) => d.channel);
  return [
    {
      title: _("Activate"),
      onClick: () => updater({ action: "enable", devices: ids }),
    },
    {
      title: _("Deactivate"),
      onClick: () => updater({ action: "disable", devices: ids }),
    },
    {
      isSeparator: true,
    },
    {
      title: _("Set DIAG on"),
      onClick: () => updater({ action: "diagOn", devices: ids }),
    },
    {
      title: _("Set DIAG off"),
      onClick: () => updater({ action: "diagOff", devices: ids }),
    },
    {
      isSeparator: true,
    },
    {
      title: _("Format"),
      isDanger: true,
      onClick: () => {
        dispatcher({ type: "REQUEST_FORMAT", payload: devices });
      },
    },
  ];
};

/**
 * Props for the FiltersToolbar component used in the DASD table.
 */
type FiltersToolbarProps = {
  /** Current filter state */
  filters: DASDDevicesFilters;
  /** Callback invoked when a filter value changes. */
  onFilterChange: (filter: keyof DASDDevicesFilters, value: string | number) => void;
};

/**
 * Renders the toolbar used to filter DASD devices.
 */
const FiltersToolbar = ({ filters, onFilterChange }: FiltersToolbarProps) => (
  <Toolbar>
    <ToolbarContent>
      <ToolbarGroup>
        <ToolbarItem>
          <StatusFilter value={filters.state} onChange={(_, v) => onFilterChange("state", v)} />
        </ToolbarItem>
        <ToolbarItem>
          <FormatFilter value={filters.format} onChange={(_, v) => onFilterChange("format", v)} />
        </ToolbarItem>
        <ToolbarItem>
          <TextinputFilter
            id="dasd-minchannel-filter"
            label={_("Min channel")}
            value={filters.minChannel}
            onChange={(_, v) => onFilterChange("minChannel", v)}
          />
        </ToolbarItem>
        <ToolbarItem>
          <TextinputFilter
            id="dasd-maxchannel-filter"
            label={_("Max channel")}
            value={filters.maxChannel}
            onChange={(_, v) => onFilterChange("maxChannel", v)}
          />
        </ToolbarItem>
      </ToolbarGroup>
    </ToolbarContent>
  </Toolbar>
);

/**
 * Represents the mode of the empty state shown in the DASD table.
 *
 * - "noDevices": No DASD devices are present on the system.
 * - "noFilterResults": No matching results after appluing filters.
 */
type DASDEmptyStateMode = "noDevices" | "noFilterResults";

/**
 * Props for the DASDTableEmptyState component.
 */
type DASDTableEmptyStateProps = {
  /**
   * Determines the type of empty state to display.
   */
  mode: DASDEmptyStateMode;
  /**
   * Callback to reset filters when in "noFilterResults" mode.
   */
  resetFilters: () => void;
};

/**
 * Builders for the two empty states the DASD table can enter.
 *
 * @example
 * ```tsx
 * emptyStates={{
 *   noDevices: () => <NoDevicesFound onAdd={handleAddDevice} />,
 *   noMatches: (reset) => <NoMatchesFound onReset={reset} />,
 * }}
 * ```
 */
type DASDTableEmptyStates = {
  /**
   * No devices exist in the current context.
   *
   * Close over any external actions like "Add device" in the consumer.
   **/
  noDevices: () => React.ReactNode;
  /**
   * Filters produced no results.
   *
   * The table injects `resetFilters` so consumers can wire a "Clear filters" action.
   **/
  noMatches: (resetFilters: () => void) => React.ReactNode;
};

/**
 * Displays an appropriate empty state interface for the DASD table,
 * depending on the mode.
 */
const DASDTableEmptyState = ({ mode, resetFilters }: DASDTableEmptyStateProps) => {
  switch (mode) {
    case "noDevices": {
      return (
        <EmptyState
          headingLevel="h2"
          titleText={_("No devices available")}
          icon={() => <Icon name="search_off" />}
          variant="sm"
        >
          <EmptyStateBody>{_("No DASD devices were found in this machine.")}</EmptyStateBody>
        </EmptyState>
      );
    }
    case "noFilterResults": {
      return (
        <EmptyState
          headingLevel="h2"
          titleText={_("No devices found")}
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
      );
    }
  }
};

/**
 * Encapsulates all state used by the DASD table component, including filters,
 * sorting configuration, current selection, and devices to be format.
 */
type DASDTableState = {
  /** Current sorting state */
  sortedBy: SortedBy;
  /** Current active filters applied to the device list */
  filters: DASDDevicesFilters;
  /** Currently selected devices in the UI */
  selectedDevices: MergedDevice[];
  /** Devices selected for formatting */
  devicesToFormat: MergedDevice[];
  /** Device IDs currently undergoing an async operation */
  waitingFor: MergedDevice["channel"][];
};

/**
 * Defines the initial state used by the DASD table reducer.
 */
const initialState: DASDTableState = {
  sortedBy: { index: 0, direction: "asc" },
  filters: {
    state: "all",
    format: "all",
    minChannel: "",
    maxChannel: "",
  },
  selectedDevices: [],
  devicesToFormat: [],
  waitingFor: [],
};

/**
 * Action types for updating the DASD table state via the reducer.
 */
type DASDTableAction =
  | { type: "UPDATE_SORTING"; payload: DASDTableState["sortedBy"] }
  | { type: "UPDATE_FILTERS"; payload: DASDTableState["filters"] }
  | { type: "RESET_FILTERS" }
  | { type: "UPDATE_SELECTION"; payload: DASDTableState["selectedDevices"] }
  | { type: "RESET_SELECTION" }
  | { type: "REQUEST_FORMAT"; payload: DASDTableState["devicesToFormat"] }
  | { type: "CANCEL_FORMAT_REQUEST" }
  | { type: "START_WAITING"; payload: MergedDevice["channel"][] }
  | { type: "UPDATE_WAITING"; payload: MergedDevice["channel"] }
  | { type: "UPDATE_DEVICE"; payload: MergedDevice };

/**
 * Reducer function that handles all DASD table state transitions.
 */
const reducer = (state: DASDTableState, action: DASDTableAction): DASDTableState => {
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

    case "UPDATE_SELECTION": {
      return { ...state, selectedDevices: action.payload };
    }

    case "RESET_SELECTION": {
      return { ...state, selectedDevices: initialState.selectedDevices };
    }

    case "REQUEST_FORMAT": {
      return { ...state, devicesToFormat: action.payload };
    }

    case "CANCEL_FORMAT_REQUEST": {
      return { ...state, devicesToFormat: [] };
    }

    case "START_WAITING": {
      return { ...state, waitingFor: action.payload };
    }

    case "UPDATE_WAITING": {
      const prev = state.waitingFor;
      const waitingFor = prev.filter((id) => action.payload !== id);
      return { ...state, waitingFor };
    }

    case "UPDATE_DEVICE": {
      const selectedDevices = state.selectedDevices.map((dev) =>
        action.payload.channel === dev.channel ? action.payload : dev,
      );
      const devicesToFormat = state.devicesToFormat.map((dev) =>
        action.payload.channel === dev.channel ? action.payload : dev,
      );
      return { ...state, selectedDevices, devicesToFormat };
    }
  }
};

type DASDColumnKey =
  | "channel"
  | "state"
  | "device"
  | "type"
  | "diag"
  | "format"
  | "formatted"
  | "partitionInfo";

type DASDTableColumnsOptions = {
  /** Column keys to exclude from the table. */
  omitting?: DASDColumnKey[];
};

/**
 * Column definitions for the DASD devices table.
 *
 * Each entry defines how a column is labeled, how its value is derived from a
 * DASDDevice object, and which field is used for sorting.
 *
 * These columns are consumed by the core <SelectableDataTable> component.
 */
const createColumns = ({ omitting = [] }: DASDTableColumnsOptions) => {
  const allColumns = {
    channel: {
      // TRANSLATORS: table header for a DASD devices table
      name: _("Channel ID"),
      value: (d: MergedDevice) => d.channel,
      // FIXME: Needs to be rethink with the new types. Most probably an specific type
      // for the table should be created
      // sortingKey: "hexId", // uses the hexadecimal representation for sorting
    },

    state: {
      // TRANSLATORS: table header for a DASD devices table
      name: _("State"),
      value: (d: MergedDevice) => d.state,
      sortingKey: "state",
    },
    deviceName: {
      // TRANSLATORS: table header for a DASD devices table
      name: _("Device"),
      value: (d: MergedDevice) => d.deviceName,
      sortingKey: "deviceName",
    },
    type: {
      // TRANSLATORS: table header for a DASD devices table
      name: _("Type"),
      value: (d: MergedDevice) => d.type,
      sortingKey: "type",
    },
    diag: {
      // TRANSLATORS: table header for `DIAG access mode` on DASD devices table.
      // It refers to an special disk access mode on IBM mainframes. Keep
      // untranslated.
      name: _("DIAG"),
      value: (d: MergedDevice) => {
        if (!d.state) return "";

        return d.diag ? _("Yes") : _("No");
      },
      sortingKey: "diag",
    },

    format: {
      // TRANSLATORS: table header for a column in a DASD devices table that
      // usually contains "Yes" or "No"" values
      name: _("To be format"),
      value: (d: MergedDevice) => (d.format ? _("Yes") : _("No")),
      sortingKey: "format",
    },
    formatted: {
      // TRANSLATORS: table header for a column in a DASD devices table that
      // usually contains "Yes" or "No"" values
      name: _("Formatted"),
      value: (d: MergedDevice) => (d.formatted ? _("Yes") : _("No")),
      sortingKey: "formatted",
    },
    partitionInfo: {
      // TRANSLATORS: table header for a DASD devices table
      name: _("Partition Info"),
      value: (d: MergedDevice) =>
        // Displays comma-separated partition info as individual lines using <div>
        d.partitionInfo.split(",").map((d: string) => <div key={d}>{d}</div>),
      sortingKey: "partitionInfo",
    },
  };

  return Object.values(omit(allColumns, omitting));
};

type DASDTableProps = {
  /** List of DASD devices to display. */
  devices: MergedDevice[];
  /**
   * Renders when filters produce no results. Receives `resetFilters` so
   * consumers can wire a "Clear filters" action without accessing internal
   * table state.
   *
   * @example
   * ```tsx
   * noMatchesState={(reset) => <NoMatchesFound onReset={reset} />}
   * ```
   */
  noMatchesState?: (resetFilters: () => void) => React.ReactNode;
  omitColumns?: DASDTableColumnsOptions["omitting"];
  /** Overrides the default actions builder. Return an empty array to disable actions entirely. */
  itemActions?: (device: MergedDevice) => IAction[];
};

/**
 * Displays a filterable, sortable, and selectable table of DASD devices.
 */
export default function DASDTable({
  devices,
  itemActions,
  omitColumns,
  noMatchesState,
}: DASDTableProps) {
  const client = useInstallerClient();
  // FIXME: use new api useDASDDevices();
  // const configDevices: ConfigDevice[] = [
  //   {
  //     channel: "0.0.0160",
  //     diag: false,
  //     format: true,
  //     state: "offline",
  //   },
  //   {
  //     channel: "0.0.0200",
  //   },
  // ];
  //
  // const systemDevices: SystemDevice[] = [
  //   {
  //     channel: "0.0.0160",
  //     active: false,
  //     deviceName: "",
  //     type: "",
  //     formatted: false,
  //     diag: true,
  //     status: "active",
  //     accessType: "",
  //     partitionInfo: "",
  //   },
  //   {
  //     channel: "0.0.0200",
  //     active: true,
  //     deviceName: "dasda",
  //     type: "eckd",
  //     formatted: false,
  //     diag: false,
  //     status: "active",
  //     accessType: "rw",
  //     partitionInfo: "1",
  //   },
  // ];
  //
  // const devices = extendCollection(configDevices, { with: systemDevices, matching: "channel" });

  // FIXME: use te equivalent in the new API
  // const { mutate: updateDASD } = useDASDMutation();
  const [state, dispatch] = useReducer(reducer, initialState);

  const columns = createColumns({ omitting: omitColumns });

  useEffect(() => {
    if (!client) return;

    return client.onEvent((event) => {
      if (event.type === "DASDDeviceChanged") {
        dispatch({ type: "UPDATE_DEVICE", payload: event.device });
        dispatch({ type: "UPDATE_WAITING", payload: event.device.id });
      }
    });
  }, [client, dispatch]);

  const onSortingChange = (sortedBy: SortedBy) => {
    dispatch({ type: "UPDATE_SORTING", payload: sortedBy });
  };

  const onFilterChange = (filter: keyof DASDDevicesFilters, value) => {
    dispatch({ type: "UPDATE_FILTERS", payload: { [filter]: value } });
    dispatch({ type: "RESET_SELECTION" });
  };

  const onSelectionChange = (devices: MergedDevice[]) => {
    dispatch({ type: "UPDATE_SELECTION", payload: devices });
  };

  const resetFilters = () => dispatch({ type: "RESET_FILTERS" });

  // Filtering
  const filteredDevices = filterDevices(devices, state.filters);

  // Sorting
  const sortingKey = columns[state.sortedBy.index].sortingKey;
  const sortedDevices = sortCollection(filteredDevices, state.sortedBy.direction, sortingKey);

  // Determine the appropriate empty state mode, if needed
  let emptyMode: DASDEmptyStateMode;
  if (isEmpty(filteredDevices)) {
    emptyMode = state.filters === initialState.filters ? "noDevices" : "noFilterResults";
  }
  /**
   * Dispatches a DASD mutation and marks devices as waiting.
   *
   * @param mutation Parameters describing the DASD update operation
   */
  const updater = (options) => console.log("FIXME: implement equivalente for new API", options);

  const defaultActions = (device: MergedDevice) =>
    buildActions({ devices: [device], updater, dispatcher: dispatch });

  const actionsBuilder = itemActions ?? defaultActions;

  return (
    <Content>
      {!isEmpty(state.waitingFor) && (
        <Popup isOpen title={_("Applying changes")} disableFocusTrap>
          <Content component="p" isEditorial>
            {_("This may take a moment while updates complete.")}
          </Content>
          <Content component="p">
            {_("This message will close automatically when everything is done.")}
          </Content>
        </Popup>
      )}
      <FiltersToolbar filters={state.filters} onFilterChange={onFilterChange} />

      {!isEmpty(state.devicesToFormat) && (
        <FormatActionHandler
          devices={state.devicesToFormat}
          onAccept={() => {
            dispatch({ type: "CANCEL_FORMAT_REQUEST" });
          }}
          onCancel={() => dispatch({ type: "CANCEL_FORMAT_REQUEST" })}
        />
      )}

      <SelectableDataTable
        columns={columns}
        items={sortedDevices}
        itemIdKey="channel"
        selectionMode="multiple"
        itemsSelected={state.selectedDevices}
        variant="compact"
        onSelectionChange={onSelectionChange}
        sortedBy={state.sortedBy}
        updateSorting={onSortingChange}
        allowSelectAll
        itemActions={actionsBuilder}
        itemActionsLabel={(d) => `Actions for ${d.id}`}
        emptyState={noMatchesState?.(resetFilters)}
      />
    </Content>
  );
}
