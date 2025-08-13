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
  TextInputGroup,
  TextInputGroupMain,
  TextInputGroupUtilities,
  Toolbar,
  ToolbarContent,
  ToolbarGroup,
  ToolbarItem,
} from "@patternfly/react-core";
import { sort } from "fast-sort";
import { isEmpty } from "radashi";
import Icon from "~/components/layout/Icon";
import SelectableDataTable from "~/components/core/SelectableDataTable";
import FormatActionHandler from "~/components/storage/dasd/FormatActionHandler";
import type { SortedBy } from "~/components/core/SelectableDataTable";
import { DASDDevice } from "~/types/dasd";
import { useDASDDevices, useDASDMutation } from "~/queries/storage/dasd";
import { hex } from "~/utils";
import { sprintf } from "sprintf-js";
import { _, n_ } from "~/i18n";

const columns = [
  {
    // TRANSLATORS: table header for a DASD devices table
    name: _("Channel ID"),
    sortingKey: "hexId",
    value: (d: DASDDevice) => d.id,
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
      d.diag ? _("Yes") : _("No");
    },
    sortingKey: "diag",
  },
  {
    // TRANSLATORS: table header for a column in a DASD devices table that
    // usually contents Yes or No values
    name: _("Formatted"),
    value: (d: DASDDevice) => (d.formatted ? _("Yes") : _("No")),
    sortingKey: "formatted",
  },
  {
    // TRANSLATORS: table header for a DASD devices table
    name: _("Partition Info"),
    value: (d: DASDDevice) => d.partitionInfo.split(",").map((d: string) => <div key={d}>{d}</div>),
    sortingKey: "partitionInfo",
  },
];

const filterDevices = (devices: DASDDevice[], from: string, to: string): DASDDevice[] => {
  const allChannels = devices.map((d) => d.hexId);
  const min = hex(from) || Math.min(...allChannels);
  const max = hex(to) || Math.max(...allChannels);

  return devices.filter((d) => d.hexId >= min && d.hexId <= max);
};

type FilterOptions = {
  minChannel?: string;
  maxChannel?: string;
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
  filters: FilterOptions;
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

    case "REQUEST_FORMAT": {
      return { ...state, devicesToFormat: action.payload };
    }

    case "CANCEL_FORMAT_REQUEST": {
      return { ...state, devicesToFormat: [] };
    }
  }
};

export default function DASDTable() {
  const devices = useDASDDevices();
  const { mutate: updateDASD } = useDASDMutation();

  const [state, dispatch] = useReducer(reducer, initialState);

  const onSortingChange = (sortedBy: SortedBy) => {
    dispatch({ type: "UPDATE_SORTING", payload: sortedBy });
  };

  const onFilterChange = (filter: keyof FilterOptions, value) => {
    dispatch({ type: "UPDATE_FILTERS", payload: { [filter]: value } });
  };

  const onSelectionChange = (devices: DASDDevice[]) => {
    dispatch({ type: "UPDATE_SELECTION", payload: devices });
  };

  // Filtering
  const filteredDevices = filterDevices(
    devices,
    state.filters.minChannel,
    state.filters.maxChannel,
  );

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
                <TextInputGroup label="">
                  <TextInputGroupMain
                    type="text"
                    value={state.filters.minChannel}
                    aria-label={_("Filter by min channel")}
                    placeholder={_("Filter by min channel")}
                    onChange={(_, v) => onFilterChange("minChannel", v)}
                  />
                  {state.filters.minChannel !== "" && (
                    <TextInputGroupUtilities>
                      <Button
                        variant="plain"
                        aria-label={_("Remove min channel filter")}
                        onClick={() => onFilterChange("minChannel", "")}
                        icon={<Icon name="backspace" />}
                      />
                    </TextInputGroupUtilities>
                  )}
                </TextInputGroup>
              </ToolbarItem>
              <ToolbarItem>
                <TextInputGroup>
                  <TextInputGroupMain
                    type="text"
                    value={state.filters.maxChannel}
                    aria-label={_("Filter by max channel")}
                    placeholder={_("Filter by max channel")}
                    onChange={(_, v) => onFilterChange("maxChannel", v)}
                  />
                  {state.filters.maxChannel !== "" && (
                    <TextInputGroupUtilities>
                      <Button
                        variant="plain"
                        aria-label={_("Remove max channel filter")}
                        onClick={() => onFilterChange("maxChannel", "")}
                        icon={<Icon name="backspace" />}
                      />
                    </TextInputGroupUtilities>
                  )}
                </TextInputGroup>
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
