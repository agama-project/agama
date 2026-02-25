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
  Divider,
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
import Popup from "~/components/core/Popup";
import FormatActionHandler from "~/components/storage/dasd/FormatActionHandler";
import SelectableDataTable, { SortedBy } from "~/components/core/SelectableDataTable";
import TextinputFilter from "~/components/storage/dasd/TextinputFilter";
import SimpleSelector from "~/components/core/SimpleSelector";
import { useAddOrUpdateDevices } from "~/hooks/model/config/dasd";
import { hex, sortCollection, translateEntries } from "~/utils";
import { _, n_, N_ } from "~/i18n";

import type { Device } from "~/model/system/dasd";
import type { Device as ConfigDevice } from "~/model/config/dasd";

/**
 * Filter options for narrowing down DASD devices shown in the table.
 *
 * All filters are optional and may be combined.
 */
export type DASDDevicesFilters = {
  /** Lower bound for channel ID filtering (inclusive). */
  minChannel?: Device["channel"];
  /** Upper bound for channel ID filtering (inclusive). */
  maxChannel?: Device["channel"];
  /** Only show devices with this status (e.g. "active", "offline"). */
  status?: "all" | Device["status"];
  /** Filter by formatting status: "yes" (formatted), "no" (not formatted), or
   * "all" (all devices). */
  formatted?: "all" | "yes" | "no";
};

/**
 * Predicate function for evaluating whether a DASD device meets a given
 * condition.
 *
 * Used internally to compose filter logic when narrowing down the list of
 * devices shown in the DASD table.
 */
type DASDDeviceCondition = (device: Device) => boolean;

/**
 * Props shared by `buildActions` and `BulkActionsToolbar`.
 *
 * Covers both single-device row actions and multi-device bulk actions.
 */
type DASDActionsProps = {
  /** Devices to act on. */
  devices: Device[];
  /**
   * Persists device config changes to the backend.
   * Used for activate, deactivate, DIAG toggle, etc.
   */
  addOrUpdateDevices: ReturnType<typeof useAddOrUpdateDevices>;
  /**
   * Dispatcher for local UI state changes, such as opening the format
   * confirmation dialog.
   */
  dispatcher: React.Dispatch<DASDTableAction>;
  /**
   * When true, filters the returned actions to only those relevant to the
   * current state of the first device in `devices`. Intended for single-device
   * row actions where showing irrelevant options (e.g. "Activate" for an
   * already active device) would be noisy.
   *
   * If false, returns the full set of actions regardless of device state,
   * intented for bulk operations over a mixed selection.
   */
  filterByDevice?: boolean;
};

/**
 * Possible DASD devices statuses.
 *
 * Values use `N_()` for translation extraction. Translate with `_()` at render time.
 *
 * @example
 * ```ts
 * const statusLabel = _(STATUS_OPTIONS[device.status]);
 * ```
 */
const STATUS_OPTIONS = {
  active: N_("Active"),
  offline: N_("Offline"),
  read_only: N_("Read only"),
};

/**
 * Possible DASD format state.
 *
 * Values use `N_()` for translation extraction. Translate with `_()` at render time.
 *
 * @example
 * ```ts
 * const formatLabel = _(FORMAT_OPTIONS[device.formatted]);
 * ```
 */
const FORMAT_OPTIONS = {
  yes: N_("Yes"),
  no: N_("No"),
};

/**
 * Filters an array of devices based on given filters.
 *
 * @param devices - The array of DASD Device objects to filter.
 * @param filters - The filters to apply.
 * @returns The filtered array of DASD Device objects matching all conditions.
 */
const filterDevices = (devices: Device[], filters: DASDDevicesFilters): Device[] => {
  const { minChannel, maxChannel, status, formatted } = filters;

  const conditions: DASDDeviceCondition[] = [];

  if (minChannel || maxChannel) {
    const allChannels = devices.map((d) => hex(d.channel));
    const min = hex(minChannel) || Math.min(...allChannels);
    const max = hex(maxChannel) || Math.max(...allChannels);

    conditions.push((d) => hex(d.channel) >= min && hex(d.channel) <= max);
  }

  if (status && status !== "all") {
    conditions.push((d) => d.status === status);
  }

  if (formatted === "yes" || formatted === "no") {
    conditions.push((d) => (formatted === "yes" ? d.formatted : !d.formatted));
  }

  return devices.filter((device) => conditions.every((conditionFn) => conditionFn(device)));
};

/**
 * Builds the list of actions available for the given devices.
 *
 * When `filterByDevice` is true, only actions relevant to the current state of
 * `devices[0]` are included (e.g. "Activate" is omitted if the device is
 * already active). This is intended for single-device row actions where showing
 * irrelevant options would be noisy.
 *
 * When false (default), the full set of actions is returned regardless of
 * device state, which is the right behavior for bulk operations where the
 * selection may contain devices in mixed states.
 */
const buildActions = ({
  devices,
  addOrUpdateDevices,
  dispatcher,
  filterByDevice = false,
}: DASDActionsProps) => {
  const actions = [
    {
      id: "activate",
      title: _("Activate"),
      onClick: () =>
        addOrUpdateDevices(
          devices.map(
            (d): ConfigDevice => ({ channel: d.channel, state: "active", diag: undefined }),
          ),
        ),
    },
    {
      id: "deactivate",
      title: _("Deactivate"),
      onClick: () =>
        addOrUpdateDevices(
          devices.map(
            (d): ConfigDevice => ({ channel: d.channel, state: "offline", diag: undefined }),
          ),
        ),
    },
    {
      id: "diagOn",
      title: _("Set DIAG on"),
      onClick: () =>
        addOrUpdateDevices(
          devices.map((d): ConfigDevice => ({ channel: d.channel, state: "active", diag: true })),
        ),
    },
    {
      id: "diagOff",
      title: _("Set DIAG off"),
      onClick: () =>
        addOrUpdateDevices(
          devices.map((d): ConfigDevice => ({ channel: d.channel, state: "active", diag: false })),
        ),
    },
    {
      id: "format",
      title: _("Format"),
      isDanger: true,
      onClick: () => {
        dispatcher({ type: "REQUEST_FORMAT", payload: devices });
      },
    },
  ];

  if (filterByDevice) {
    const [device] = devices;
    const keptActions = {
      activate: !device.active,
      deactivate: device.active,
      diagOn: !device.diag,
      diagOff: device.diag,
      format: !device.formatted,
    };

    return actions.filter((a) => keptActions[a.id]);
  }

  return actions;
};

/** Props for `FiltersToolbar`. */
type FiltersToolbarProps = {
  /** Currently active filter values. */
  filters: DASDDevicesFilters;
  /**
   * Unique statuses present in the current device list, used to restrict the
   * status filter to only relevant options. Does not include the synthetic "all"
   * option.
   */
  availableStatuses: Device["status"][];
  /** Whether any filter differs from its default value. */
  hasActiveFilters: boolean;
  /** Total number of devices before filtering. */
  totalDevices: number;
  /** Number of devices that pass the current filters. */
  matchingDevices: number;
  /** Callback invoked when a single filter value changes. */
  onFilterChange: (filter: keyof DASDDevicesFilters, value: string | number) => void;
  /** Callback invoked when all filters should be reset to their defaults. */
  onReset: () => void;
};

/**
 * Renders the filter controls toolbar for the DASD table.
 *
 * Displays status, format, and channel range filters alongside a device count
 * summary. When any filter is active the count switches from "N devices
 * available" to "M of N devices match filters" and a "Clear all filters" link
 * appears.
 */
const FiltersToolbar = ({
  filters,
  availableStatuses,
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
            <SimpleSelector
              label={_("Status")}
              value={filters.status}
              options={{
                all: _("All"),
                ...translateEntries(STATUS_OPTIONS, {
                  filter: (k) => availableStatuses.includes(k),
                }),
              }}
              onChange={(_, v) => onFilterChange("status", v)}
            />
          </ToolbarItem>
          <ToolbarItem>
            <SimpleSelector
              label={_("Formatted")}
              value={filters.formatted}
              options={{ all: _("All"), ...translateEntries(FORMAT_OPTIONS) }}
              onChange={(_, v) => onFilterChange("formatted", v)}
            />
          </ToolbarItem>
          <ToolbarItem>
            <TextinputFilter
              id="dasd-minchannel-filter"
              label={_("Min channel")}
              value={filters.minChannel}
              width="120px"
              onChange={(_, v) => onFilterChange("minChannel", v)}
            />
          </ToolbarItem>
          <ToolbarItem>
            <TextinputFilter
              id="dasd-maxchannel-filter"
              label={_("Max channel")}
              value={filters.maxChannel}
              width="120px"
              onChange={(_, v) => onFilterChange("maxChannel", v)}
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

/**
 * Displays a toolbar containing bulk action buttons for selected DASD devices.
 *
 * @remarks
 * When no devices are selected an instructional hint is shown instead.
 * Reuses `DASDActionsProps` since it needs the same dependencies as `buildActions`.
 */
const BulkActionsToolbar = ({ devices, addOrUpdateDevices, dispatcher }: DASDActionsProps) => {
  const applyText = sprintf(
    n_(
      // TRANSLATORS: message shown in bulk action toolbar when just one device
      // is selected
      "Actions for the selected device:",
      // TRANSLATORS: message shown in bulk action toolbar when some devices are
      // selected. %s is replaced with the amount of devices
      "Actions for %s selected devices:",
      devices.length,
    ),
    devices.length,
  );

  return (
    <Toolbar inset={{ default: "insetSm" }}>
      <ToolbarContent alignItems="center">
        {devices.length ? (
          <>
            <ToolbarGroup>
              <ToolbarItem>
                <Content>{applyText}</Content>
              </ToolbarItem>
            </ToolbarGroup>

            <ToolbarGroup gap={{ default: "gapXs" }} alignSelf="end" variant="action-group">
              {buildActions({ devices, addOrUpdateDevices, dispatcher }).map(
                ({ onClick, title }, i) => (
                  <ToolbarItem key={i}>
                    <Button size="sm" onClick={onClick} variant="control">
                      {title}
                    </Button>
                  </ToolbarItem>
                ),
              )}
            </ToolbarGroup>
          </>
        ) : (
          <Text textStyle={"textColorSubtle"}>{_("Select devices to perform bulk actions")}</Text>
        )}
      </ToolbarContent>
    </Toolbar>
  );
};

/** Internal state shape for the DASD table component. */
type DASDTableState = {
  /** Current sorting state */
  sortedBy: SortedBy;
  /** Current active filters applied to the device list */
  filters: DASDDevicesFilters;
  /** Currently selected devices in the UI */
  selectedDevices: Device[];
  /** Devices selected for formatting */
  devicesToFormat: Device[];
  /** Device IDs currently undergoing an async operation */
  waitingFor: Device["channel"][];
};

/**
 * Initial state for `reducer`.
 *
 * @remarks
 * Also serves as the canonical "no filters active" reference: filter changes
 * are detected by comparing the current filters against this object via
 * `JSON.stringify`.
 */
const initialState: DASDTableState = {
  sortedBy: { index: 0, direction: "asc" },
  filters: {
    status: "all",
    formatted: "all",
    minChannel: "",
    maxChannel: "",
  },
  selectedDevices: [],
  devicesToFormat: [],
  waitingFor: [],
};

/**
 * Union of all actions that can be dispatched to update the DASD table state.
 **/
type DASDTableAction =
  | { type: "UPDATE_SORTING"; payload: DASDTableState["sortedBy"] }
  | { type: "UPDATE_FILTERS"; payload: DASDTableState["filters"] }
  | { type: "RESET_FILTERS" }
  | { type: "UPDATE_SELECTION"; payload: DASDTableState["selectedDevices"] }
  | { type: "RESET_SELECTION" }
  | { type: "REQUEST_FORMAT"; payload: DASDTableState["devicesToFormat"] }
  | { type: "CANCEL_FORMAT_REQUEST" }
  | { type: "UPDATE_DEVICE"; payload: Device };

/**
 * Reducer for the DASD table.
 *
 * Handles all state transitions driven by `DASDTableAction` dispatches.
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

/**
 * Column definitions for the DASD devices table.
 *
 * Each entry defines the column header label, how its value is derived from a
 * `Device`, and which field drives sorting. Consumed by `SelectableDataTable`.
 */
const createColumns = () => [
  {
    // TRANSLATORS: table header for a DASD devices table
    name: _("Channel"),
    value: (d: Device) => d.channel,
    sortingKey: (d: Device) => hex(d.channel),
  },
  {
    // TRANSLATORS: table header for a DASD devices table
    name: _("Status"),
    value: (d: Device) => STATUS_OPTIONS[d.status],
    sortingKey: "status",
  },
  {
    // TRANSLATORS: table header for a DASD devices table
    name: _("Device"),
    value: (d: Device) => d.deviceName,
    sortingKey: "deviceName",
  },

  {
    // TRANSLATORS: table header for a DASD devices table
    name: _("Type"),
    value: (d: Device) => d.type,
    sortingKey: "type",
  },
  {
    // TRANSLATORS: table header for `DIAG access mode` on DASD devices table.
    // It refers to an special disk access mode on IBM mainframes. Keep
    // untranslated.
    name: _("DIAG"),
    value: (d: Device) => {
      if (!d.status) return "";

      return d.diag ? _("Yes") : _("No");
    },
    sortingKey: "diag",
  },
  {
    // TRANSLATORS: table header for a column in a DASD devices table that
    // usually contains "Yes" or "No"" values
    name: _("Formatted"),
    value: (d: Device) => (d.formatted ? _("Yes") : _("No")),
    sortingKey: "formatted",
  },
  {
    // TRANSLATORS: table header for a DASD devices table
    name: _("Partition Info"),

    value: (d: Device) =>
      // Displays comma-separated partition info as individual lines using <div>
      d.partitionInfo.split(",").map((d: string) => <div key={d}>{d}</div>),
    sortingKey: "partitionInfo",
  },
];

/**
 * Displays a filterable, sortable, selectable table of DASD storage devices.
 *
 * Manages its own UI state (filters, sorting, selection, pending format
 * requests) via a reducer.
 */
export default function DASDTable({ devices }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const addOrUpdateDevices = useAddOrUpdateDevices();

  const columns = createColumns();

  const onSortingChange = (sortedBy: SortedBy) => {
    dispatch({ type: "UPDATE_SORTING", payload: sortedBy });
  };

  const onFilterChange = (filter: keyof DASDDevicesFilters, value) => {
    dispatch({ type: "UPDATE_FILTERS", payload: { [filter]: value } });
    dispatch({ type: "RESET_SELECTION" });
  };

  const onSelectionChange = (devices: Device[]) => {
    dispatch({ type: "UPDATE_SELECTION", payload: devices });
  };

  const resetFilters = () => dispatch({ type: "RESET_FILTERS" });

  // Filtering
  const filteredDevices = filterDevices(devices, state.filters);

  // Sorting
  const sortingKey = columns[state.sortedBy.index].sortingKey;
  const sortedDevices = sortCollection(filteredDevices, state.sortedBy.direction, sortingKey);

  const availableStatuses = [
    ...new Set(devices.map((d: Device) => d.status)),
  ] as Device["status"][];

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
      <FiltersToolbar
        filters={state.filters}
        availableStatuses={availableStatuses}
        hasActiveFilters={JSON.stringify(state.filters) !== JSON.stringify(initialState.filters)}
        totalDevices={devices.length}
        matchingDevices={filteredDevices.length}
        onFilterChange={onFilterChange}
        onReset={resetFilters}
      />
      {!isEmpty(filteredDevices) && (
        <>
          <Divider />
          <BulkActionsToolbar
            devices={state.selectedDevices}
            addOrUpdateDevices={addOrUpdateDevices}
            dispatcher={dispatch}
          />
          <Divider />
        </>
      )}

      {!isEmpty(state.devicesToFormat) && (
        <FormatActionHandler
          devices={state.devicesToFormat}
          onFormat={() => {
            addOrUpdateDevices(
              state.devicesToFormat.map(
                (d): ConfigDevice => ({ channel: d.channel, format: true }),
              ),
            );
          }}
          onClose={() => dispatch({ type: "CANCEL_FORMAT_REQUEST" })}
        />
      )}

      <SelectableDataTable
        columns={columns}
        items={sortedDevices}
        selectionMode="multiple"
        itemsSelected={state.selectedDevices}
        variant="compact"
        onSelectionChange={onSelectionChange}
        sortedBy={state.sortedBy}
        updateSorting={onSortingChange}
        allowSelectAll
        itemActions={(d: Device) =>
          isEmpty(state.selectedDevices.length)
            ? buildActions({
                devices: [d],
                addOrUpdateDevices,
                dispatcher: dispatch,
                filterByDevice: true,
              })
            : []
        }
        itemActionsLabel={(d: Device) => `Actions for ${d.channel}`}
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
