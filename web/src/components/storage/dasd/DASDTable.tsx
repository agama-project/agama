/*
 * Copyright (c) [2023-2025] SUSE LLC
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
import {
  Button,
  Content,
  Divider,
  Toolbar,
  ToolbarContent,
  ToolbarGroup,
  ToolbarItem,
} from "@patternfly/react-core";
import FormatActionHandler from "~/components/storage/dasd/FormatActionHandler";
import FormatFilter from "~/components/storage/dasd/FormatFilter";
import SelectableDataTable from "~/components/core/SelectableDataTable";
import StatusFilter from "~/components/storage/dasd/StatusFilter";
import TextinputFilter from "~/components/storage/dasd/TextinputFilter";
import { DASDDevice } from "~/types/dasd";
import type { SortedBy } from "~/components/core/SelectableDataTable";
import { useDASDDevices, useDASDMutation } from "~/queries/storage/dasd";
import { sort } from "fast-sort";
import { isEmpty } from "radashi";
import { hex } from "~/utils";
import { _, n_ } from "~/i18n";
import { sprintf } from "sprintf-js";

/**
 * Filter options for narrowing down DASD devices shown in the table.
 *
 * All filters are optional and may be combined.
 */
export type DASDDevicesFilters = {
  /** Lower bound for channel ID filtering (inclusive). */
  minChannel?: DASDDevice["id"];
  /** Upper bound for channel ID filtering (inclusive). */
  maxChannel?: DASDDevice["id"];
  /** Only show devices with this status (e.g. "read_only", "offline"). */
  status?: DASDDevice["status"];
  /** Filter by formatting status: "yes" (formatted), "no" (not formatted), or
   * "all" (all devices). */
  formatted?: "all" | "yes" | "no";
};

type DASDDeviceCondition = (device: DASDDevice) => boolean;

/**
 * Filters an array of devices based on given filters.
 *
 * @param devices - The array of DASDDevice objects to filter.
 * @param filters - The filters to apply.
 * @returns The filtered array of DASDDevice objects matching all conditions.
 */
const filterDevices = (devices: DASDDevice[], filters: DASDDevicesFilters): DASDDevice[] => {
  const { minChannel, maxChannel, status, formatted } = filters;

  const conditions: DASDDeviceCondition[] = [];

  if (minChannel || maxChannel) {
    const allChannels = devices.map((d) => d.hexId);
    const min = hex(minChannel) || Math.min(...allChannels);
    const max = hex(maxChannel) || Math.max(...allChannels);

    conditions.push((d) => d.hexId >= min && d.hexId <= max);
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
 * Provides individual action buttons for a group of selected DASD devices.
 */
const BulkActions = ({ devices, onFormatRequest }) => {
  const { mutate: updateDASD } = useDASDMutation();

  const devicesIds = devices.map((d) => d.id);
  const actions = [
    {
      title: _("Activate"),
      onClick: () => updateDASD({ action: "enable", devices: devicesIds }),
    },
    {
      title: _("Deactivate"),
      onClick: () => updateDASD({ action: "disable", devices: devicesIds }),
    },
    {
      isSeparator: true,
    },
    {
      title: _("Set DIAG on"),
      onClick: () => updateDASD({ action: "diagOn", devices: devicesIds }),
    },
    {
      title: _("Set DIAG off"),
      onClick: () => updateDASD({ action: "diagOff", devices: devicesIds }),
    },
    {
      isSeparator: true,
    },
    {
      title: _("Format"),
      onClick: () => onFormatRequest(devices),
    },
  ];

  return actions
    .filter((a) => !a.isSeparator)
    .map(({ onClick, title }, i) => (
      <ToolbarItem key={i}>
        <Button size="sm" key={i} onClick={onClick} variant="control">
          {title}
        </Button>
      </ToolbarItem>
    ));
};
/**
 * Toolbar section displaying available bulk actions for selected devices.
 * Dynamically adjusted based on selection count.
 */
const ActionsToolbar = ({ devices, onFormatRequest }) => {
  const text = sprintf(
    n_(
      // TRANSLATORS: message shown in bulk action toolbar when just one device
      // is selected
      "Apply to the selected device",
      // TRANSLATORS: message shown in bulk action toolbar when some devices are
      // selected. %s is replaced with the amount of devices
      "Apply to the %s selected devices",
      devices.length,
    ),
    devices.length,
  );

  return (
    <Toolbar>
      <ToolbarContent>
        <ToolbarGroup>
          {devices.length ? (
            <>
              {text} <BulkActions devices={devices} onFormatRequest={onFormatRequest} />
            </>
          ) : (
            _("Select devices to enable bulk actions.")
          )}
        </ToolbarGroup>
      </ToolbarContent>
    </Toolbar>
  );
};

/**
 * Encapsulates all state used by the DASD table component, including filters,
 * sorting configuration, current selection, and devices to be format.
 */
type DASDTableState = {
  sortedBy: SortedBy;
  filters: DASDDevicesFilters;
  selectedDevices: DASDDevice[];
  devicesToFormat: DASDDevice[];
};

/**
 * Defines the initial state used by the DASD table reducer.
 */
const initialState: DASDTableState = {
  sortedBy: { index: 0, direction: "asc" },
  filters: {
    minChannel: "",
    maxChannel: "",
    status: "all",
    formatted: "all",
  },
  selectedDevices: [],
  devicesToFormat: [],
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
  | { type: "CANCEL_FORMAT_REQUEST" };

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
  }
};

/**
 * Column definitions for the DASD devices table.
 *
 * Each entry defines how a column is labeled, how its value is derived from a
 * DASDDevice object, and which field is used for sorting.
 *
 * These columns are consumed by the core <SelectableDataTable> component.
 */
const columns = [
  {
    // TRANSLATORS: table header for a DASD devices table
    name: _("Channel ID"),
    value: (d: DASDDevice) => d.id,
    sortingKey: "hexId", // uses the hexadecimal representation for sorting
  },

  {
    // TRANSLATORS: table header for a DASD devices table
    name: _("Status"),
    value: (d: DASDDevice) => d.status,
    sortingKey: "status",
  },
  {
    // TRANSLATORS: table header for a DASD devices table
    name: _("Device"),
    value: (d: DASDDevice) => d.deviceName,
    sortingKey: "deviceName",
  },
  {
    // TRANSLATORS: table header for a DASD devices table
    name: _("Type"),
    value: (d: DASDDevice) => d.deviceType,
    sortingKey: "deviceType",
  },
  {
    // TRANSLATORS: table header for `DIAG access mode` on DASD devices table.
    // It refers to an special disk access mode on IBM mainframes. Keep
    // untranslated.
    name: _("DIAG"),
    value: (d: DASDDevice) => {
      if (!d.enabled) return "";

      return d.diag ? _("Yes") : _("No");
    },
    sortingKey: "diag",
  },
  {
    // TRANSLATORS: table header for a column in a DASD devices table that
    // usually contains "Yes" or "No"" values
    name: _("Formatted"),
    value: (d: DASDDevice) => (d.formatted ? _("Yes") : _("No")),
    sortingKey: "formatted",
  },
  {
    // TRANSLATORS: table header for a DASD devices table
    name: _("Partition Info"),

    value: (d: DASDDevice) =>
      // Displays comma-separated partition info as individual lines using <div>
      d.partitionInfo.split(",").map((d: string) => <div key={d}>{d}</div>),
    sortingKey: "partitionInfo",
  },
];

export default function DASDTable() {
  const devices = useDASDDevices();
  const { mutate: updateDASD } = useDASDMutation();

  const [state, dispatch] = useReducer(reducer, initialState);

  const onSortingChange = (sortedBy: SortedBy) => {
    dispatch({ type: "UPDATE_SORTING", payload: sortedBy });
  };

  const onFilterChange = (filter: keyof DASDDevicesFilters, value) => {
    dispatch({ type: "UPDATE_FILTERS", payload: { [filter]: value } });
    dispatch({ type: "RESET_SELECTION" });
  };

  const onSelectionChange = (devices: DASDDevice[]) => {
    dispatch({ type: "UPDATE_SELECTION", payload: devices });
  };

  // Filtering
  const filteredDevices = filterDevices(devices, state.filters);

  // Sorting
  // See https://github.com/snovakovic/fast-sort
  const sortedDevices = sort(filteredDevices)[state.sortedBy.direction](
    (d) => d[columns[state.sortedBy.index].sortingKey],
  );

  return (
    <>
      <Content>
        <Toolbar>
          <ToolbarContent>
            <ToolbarGroup>
              <ToolbarItem>
                <StatusFilter
                  value={state.filters.status}
                  onChange={(_, v) => onFilterChange("status", v)}
                />
              </ToolbarItem>
              <ToolbarItem>
                <FormatFilter
                  value={state.filters.formatted}
                  onChange={(_, v) => onFilterChange("formatted", v)}
                />
              </ToolbarItem>
              <ToolbarItem>
                <TextinputFilter
                  id="dasd-minchannel-filter"
                  label={_("Min channel")}
                  value={state.filters.minChannel}
                  onChange={(_, v) => onFilterChange("minChannel", v)}
                />
              </ToolbarItem>
              <ToolbarItem>
                <TextinputFilter
                  id="dasd-maxchannel-filter"
                  label={_("Max channel")}
                  value={state.filters.maxChannel}
                  onChange={(_, v) => onFilterChange("maxChannel", v)}
                />
              </ToolbarItem>
            </ToolbarGroup>
          </ToolbarContent>
        </Toolbar>
        <Divider />
        <ActionsToolbar
          devices={state.selectedDevices}
          onFormatRequest={() =>
            dispatch({ type: "REQUEST_FORMAT", payload: state.selectedDevices })
          }
        />
        <Divider />
      </Content>

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
        selectionMode="multiple"
        itemsSelected={state.selectedDevices}
        variant="compact"
        onSelectionChange={onSelectionChange}
        sortedBy={state.sortedBy}
        updateSorting={onSortingChange}
        allowSelectAll
        itemActions={(d) => [
          {
            title: _("Activate"),
            onClick: () => updateDASD({ action: "enable", devices: [d.id] }),
          },
          {
            title: _("Deactivate"),
            onClick: () => updateDASD({ action: "disable", devices: [d.id] }),
          },
          {
            isSeparator: true,
          },
          {
            title: _("Set DIAG on"),
            onClick: () => updateDASD({ action: "diagOn", devices: [d.id] }),
          },
          {
            title: _("Set DIAG off"),
            onClick: () => updateDASD({ action: "diagOff", devices: [d.id] }),
          },
          {
            isSeparator: true,
          },
          {
            title: _("Format"),
            isDanger: true,
            onClick: () => {
              dispatch({ type: "REQUEST_FORMAT", payload: [d] });
              // formatDASD([d.id]),
            },
          },
        ]}
        itemActionsLabel={(d) => `Actions for ${d.id}`}
      />
    </>
  );
}
