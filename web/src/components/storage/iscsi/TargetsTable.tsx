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

import React, { useReducer } from "react";
import {
  Button,
  Content,
  Divider,
  EmptyState,
  EmptyStateActions,
  EmptyStateBody,
  EmptyStateFooter,
  HelperText,
  HelperTextItem,
  Toolbar,
  ToolbarContent,
  ToolbarGroup,
  ToolbarItem,
} from "@patternfly/react-core";
import Icon from "~/components/layout/Icon";
import SelectableDataTable, { SortedBy } from "~/components/core/SelectableDataTable";
import StatusFilter from "~/components/storage/iscsi/StatusFilter";
import TextinputFilter from "~/components/storage/dasd/TextinputFilter";
import { isEmpty } from "radashi";
import { sortCollection, mergeSources } from "~/utils";
import { generatePath, useNavigate } from "react-router";
import { STORAGE } from "~/routes/paths";
import { _ } from "~/i18n";
import Text from "~/components/core/Text";
import { useSystem } from "~/hooks/model/system/iscsi";
import { useConfig, useRemoveTarget } from "~/hooks/model/config/iscsi";

import type { Target as ConfigTarget } from "~/openapi/config/iscsi";
import type { Target as SystemTarget, Target } from "~/openapi/system/iscsi";

type MergedTarget = Partial<SystemTarget> & Partial<ConfigTarget>;

/**
 * Filter options for narrowing down iSCSI targets shown in the table.
 *
 * All filters are optional and may be combined.
 */
export type ISCSITargetsFilters = {
  name?: string;
  portal?: string;
  status?: string;
};

/**
 * Predicate function for evaluating whether a iSCSI target meets a given
 * condition.
 *
 * Used internally to compose filter logic when narrowing down the list of
 * devices shown in the table.
 */
type ISCSITargetCondition = (target) => boolean;

/**
 * Filters an array of targets based on given filters.
 */
const filterTargets = (targets, filters) => {
  const { name, portal, status } = filters;

  const conditions: ISCSITargetCondition[] = [];

  if (!isEmpty(name)) {
    conditions.push((t) => t.name.includes(name));
  }

  if (!isEmpty(portal)) {
    conditions.push((t) => `${t.address}:${t.port}`.includes(portal));
  }

  if (status && status !== "all") {
    conditions.push((t) => {
      switch (status) {
        case "connected": {
          return t.connected === true;
        }

        case "connected_and_locked": {
          return t.connected === true && t.locked === true;
        }

        case "disconnected": {
          return t.connected !== true;
        }
      }
    });
  }

  return targets.filter((t) => conditions.every((conditionFn) => conditionFn(t)));
};

/**
 * Checks if given target failed to connect.
 */
const failedToConnect = (target: Target & { sources: string[] }): boolean => {
  return (
    target.sources.includes("system") && target.sources.includes("config") && !target.connected
  );
};

/**
 * Builds the list of available actions for given targets.
 *
 * FIXME: Implement it
 *
 * Returns an array of action objects, each with a label and an `onClick`
 * handler. (...)
 */
const buildActions = (target, navigateFn, onDelete) => {
  if (target.locked) return [];

  const { connected, sources } = target;
  const inConfig = sources.includes("config");
  const hasConnectionFailures = failedToConnect(target);

  return [
    !connected && {
      title: _("Connect"),
      onClick: () =>
        navigateFn(
          generatePath(STORAGE.iscsi.login, {
            name: target.name,
            address: target.address,
            port: target.port,
          }),
        ),
    },
    connected &&
      inConfig && {
        title: _("Disconnect"),
        onClick: () => onDelete(target.name, target.address, target.port),
      },
    hasConnectionFailures && {
      title: _("Delete"),
      onClick: () => onDelete(target.name, target.address, target.port),
      isDanger: true,
    },
  ].filter(Boolean);
};

/**
 * Props for the FiltersToolbar component used in the DASD table.
 */
type FiltersToolbarProps = {
  /** Current filter state */
  filters: ISCSITargetsFilters;
  /** Callback invoked when a filter value changes. */
  onFilterChange: (filter: keyof ISCSITargetsFilters, value: string | number) => void;
};

/**
 * Renders the toolbar used to filter targets.
 */
const FiltersToolbar = ({ filters, onFilterChange }: FiltersToolbarProps) => (
  <Toolbar>
    <ToolbarContent>
      <ToolbarGroup>
        <ToolbarItem>
          <TextinputFilter
            id="iscsi-target-name"
            label={_("Name")}
            value={filters.name}
            onChange={(_, v) => onFilterChange("name", v)}
          />
        </ToolbarItem>
        <ToolbarItem>
          <TextinputFilter
            id="iscsi-target-portal"
            label={_("Portal")}
            value={filters.portal}
            onChange={(_, v) => onFilterChange("portal", v)}
          />
        </ToolbarItem>
        <ToolbarItem>
          <StatusFilter value={filters.status} onChange={(_, v) => onFilterChange("status", v)} />
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
type TargetsEmptyStateMode = "noDevices" | "noFilterResults";

/**
 * Props for the DASDTableEmptyState component.
 */
type DASDTableEmptyStateProps = {
  /**
   * Determines the type of empty state to display.
   */
  mode: TargetsEmptyStateMode;
  /**
   * Callback to reset filters when in "noFilterResults" mode.
   */
  resetFilters: () => void;
};

/**
 * Displays an appropriate empty state interface for the DASD table,
 * depending on the mode.
 */
const ISCSITableEmptyState = ({ mode, resetFilters }: DASDTableEmptyStateProps) => {
  switch (mode) {
    case "noDevices": {
      return (
        <EmptyState
          headingLevel="h2"
          titleText={_("No targets available")}
          icon={() => <Icon name="search_off" />}
          variant="sm"
        >
          <EmptyStateBody>
            <Content isEditorial>{_("No targets have been discovered or configured.")}</Content>
            {_("Perform a discovery to find available iSCSI targets.")}
          </EmptyStateBody>
        </EmptyState>
      );
    }
    case "noFilterResults": {
      return (
        <EmptyState
          headingLevel="h2"
          titleText={_("No targets matches filters")}
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
 * Encapsulates all state used by the iSCSI targets table component, including
 * filters, sorting configuration, current selection, and devices to be format.
 *
 * FIXME: finish adaptation
 */
type TargetsTableState = {
  /** Current sorting state */
  sortedBy: SortedBy;
  /** Current active filters applied to the device list */
  filters: ISCSITargetsFilters;
  /** Currently selected devices in the UI */
  selectedDevices: MergedTarget[];
};

/**
 * Defines the initial state used by the DASD table reducer.
 */
const initialState: TargetsTableState = {
  sortedBy: { index: 0, direction: "asc" },
  filters: {
    name: "",
    portal: "",
    status: "all",
  },
  selectedDevices: [],
};

/**
 * Action types for updating the iSCSI targets table state via the reducer.
 */
type TargetsTableAction =
  | { type: "UPDATE_SORTING"; payload: TargetsTableState["sortedBy"] }
  | { type: "UPDATE_FILTERS"; payload: TargetsTableState["filters"] }
  | { type: "RESET_FILTERS" }
  | { type: "UPDATE_SELECTION"; payload: TargetsTableState["selectedDevices"] }
  | { type: "RESET_SELECTION" }
  | { type: "CANCEL_FORMAT_REQUEST" };

/**
 * Reducer function that handles all iSCSI targets table state transitions.
 */
const reducer = (state: TargetsTableState, action: TargetsTableAction): TargetsTableState => {
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
  }
};

/**
 * Column definitions for the iSCSI targets table.
 *
 * Each entry defines how a column is labeled, how its value is derived from a
 * target object, and which field is used for sorting.
 *
 * These columns are consumed by the core <SelectableDataTable> component.
 */
const createColumns = () => [
  {
    // TRANSLATORS: table header for a iSCSI targets table
    name: _("Name"),
    value: (t) => t.name,
    sortingKey: "name",
  },

  {
    // TRANSLATORS: table header for a iSCSI targets table
    name: _("Portal"),
    value: (t) => (
      <Text>
        {t.address}:
        <Text component="small" style={{ display: "inline" }}>
          {t.port}
        </Text>
      </Text>
    ),
    sortingKey: "address",
  },
  {
    // TRANSLATORS: table header for a iSCSI targets table
    name: _("Interface"),
    value: (t) => t.interface,
    sortingKey: "interface",
  },
  {
    // TRANSLATORS: table header for a iSCSI targets table
    name: _("Startup"),
    value: (t) => {
      return t.startup;
    },
    sortingKey: "startup",
  },
  {
    // TRANSLATORS: table header for a iSCSI targets table
    name: _("Status"),
    value: (t) => {
      // Not connected
      if (!t.connected) return _("Disconnected");

      // Connected but...
      if (t.locked) return _("Connected and locked");
      if (!t.sources.includes("config")) return _("Could not disconnect");

      // Simply connected and not in above situations
      return _("Connected");
    },
  },
];

export default function TargetsTable() {
  const [state, dispatch] = useReducer(reducer, initialState);
  const navigate = useNavigate();
  const configTargets = useConfig()?.targets || [];
  const systemTargets = useSystem()?.targets || [];
  const removeTarget = useRemoveTarget();

  const targets = mergeSources<MergedTarget, keyof MergedTarget>({
    collections: {
      config: configTargets,
      system: systemTargets,
    },
    precedence: ["system", "config"],
    primaryKey: ["name", "address", "port"],
  });

  const hasLocked = targets.find((t) => "locked" in t && t.locked);

  const columns = createColumns();

  const onSortingChange = (sortedBy: SortedBy) => {
    dispatch({ type: "UPDATE_SORTING", payload: sortedBy });
  };

  const onFilterChange = (filter: keyof ISCSITargetsFilters, value) => {
    dispatch({ type: "UPDATE_FILTERS", payload: { [filter]: value } });
    dispatch({ type: "RESET_SELECTION" });
  };

  const onSelectionChange = (devices: MergedTarget[]) => {
    dispatch({ type: "UPDATE_SELECTION", payload: devices });
  };

  const resetFilters = () => dispatch({ type: "RESET_FILTERS" });

  // Filtering
  const filteredDevices = filterTargets(targets, state.filters);

  // Sorting
  const sortingKey = columns[state.sortedBy.index].sortingKey;
  const sortedDevices = sortCollection(filteredDevices, state.sortedBy.direction, sortingKey);

  // Determine the appropriate empty state mode, if needed
  let emptyMode: TargetsEmptyStateMode;
  if (isEmpty(filteredDevices)) {
    emptyMode = state.filters === initialState.filters ? "noDevices" : "noFilterResults";
  }

  return (
    <Content>
      <FiltersToolbar filters={state.filters} onFilterChange={onFilterChange} />
      <Divider />
      <SelectableDataTable
        columns={columns}
        items={sortedDevices}
        selectionMode="none"
        itemsSelected={state.selectedDevices}
        variant="compact"
        onSelectionChange={onSelectionChange}
        sortedBy={state.sortedBy}
        updateSorting={onSortingChange}
        allowSelectAll
        itemActions={(target) => buildActions(target, navigate, (n, a, p) => removeTarget(n, a, p))}
        itemActionsLabel={(d) => `Actions for ${d.id}`}
        emptyState={<ISCSITableEmptyState mode={emptyMode} resetFilters={resetFilters} />}
      />
      {hasLocked && (
        <HelperText>
          <HelperTextItem variant="indeterminate">
            {_("Locked targets cannot be managed from here and do not offer any actions.")}
          </HelperTextItem>
        </HelperText>
      )}
    </Content>
  );
}
