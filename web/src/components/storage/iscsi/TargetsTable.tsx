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
import { generatePath, useNavigate } from "react-router";
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
import Text from "~/components/core/Text";
import TextinputFilter from "~/components/storage/dasd/TextinputFilter";
import { sortCollection, mergeSources } from "~/utils";
import { STORAGE } from "~/routes/paths";
import { useSystem } from "~/hooks/model/system/iscsi";
import { useConfig, useRemoveTarget } from "~/hooks/model/config/iscsi";
import { _ } from "~/i18n";

import type { Target as ConfigTarget } from "~/openapi/config/iscsi";
import type { Target as SystemTarget } from "~/openapi/system/iscsi";

type MergedTarget = Partial<SystemTarget> & Partial<ConfigTarget> & { sources: string[] };
type TargetToMerge = SystemTarget | ConfigTarget;

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
 * targets shown in the table.
 */
type ISCSITargetCondition = (target) => boolean;

/**
 * Filters an array of targets based on given filters.
 */
const filterTargets = (targets: MergedTarget[], filters: ISCSITargetsFilters): MergedTarget[] => {
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
 * Checks if a given target failed to connect.
 */
const failedToConnect = (target: MergedTarget): boolean => {
  return (
    target.sources.includes("system") && target.sources.includes("config") && !target.connected
  );
};

/**
 * Builds the list of available actions for a given target.
 *
 * @returns Array of available actions for the target, each with a label and an
 * `onClick` handler
 */
const buildActions = (
  target: MergedTarget,
  navigateFn: ReturnType<typeof useNavigate>,
  onDelete: (targetName: string, targetAddress: string, targetPort: number) => void,
) => {
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
 * Props for the FiltersToolbar component rendered along with the table.
 */
type FiltersToolbarProps = {
  /** Current filter state */
  filters: ISCSITargetsFilters;
  /** Callback invoked when a filter value changes. */
  onFilterChange: (filter: keyof ISCSITargetsFilters, value: string) => void;
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
 * Represents the mode of the empty state shown in the table.
 *
 * - "noDevices": No iSCSI targets are present on the system.
 * - "noFilterResults": No matching results after applying filters.
 */
type TargetsEmptyStateMode = "noDevices" | "noFilterResults";

/**
 * Props for the ISCSITableEmptyState component.
 */
type TargetsEmptyStateProps = {
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
 * Displays an appropriate empty state interface for the table.
 */
const TargetsEmptyState = ({ mode, resetFilters }: TargetsEmptyStateProps) => {
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
 * filters, sorting configuration, and current selection.
 */
type TargetsTableState = {
  /** Current sorting state */
  sortedBy: SortedBy;
  /** Current active filters applied to the target list */
  filters: ISCSITargetsFilters;
  /** Currently selected targets in the UI */
  selectedTargets: MergedTarget[];
};

/**
 * Defines the initial state used by table reducer.
 */
const initialState: TargetsTableState = {
  sortedBy: { index: 0, direction: "asc" },
  filters: {
    name: "",
    portal: "",
    status: "all",
  },
  selectedTargets: [],
};

/**
 * Action types for updating the iSCSI targets table state via the reducer.
 */
type TargetsTableAction =
  | { type: "UPDATE_SORTING"; payload: TargetsTableState["sortedBy"] }
  | { type: "UPDATE_FILTERS"; payload: TargetsTableState["filters"] }
  | { type: "RESET_FILTERS" }
  | { type: "UPDATE_SELECTION"; payload: TargetsTableState["selectedTargets"] }
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
      return { ...state, selectedTargets: action.payload };
    }

    case "RESET_SELECTION": {
      return { ...state, selectedTargets: initialState.selectedTargets };
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
    // TRANSLATORS: table header for an iSCSI targets table
    name: _("Name"),
    value: (t: MergedTarget) => t.name,
    sortingKey: "name",
  },

  {
    // TRANSLATORS: table header for an iSCSI targets table
    name: _("Portal"),
    value: (t: MergedTarget) => (
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
    // TRANSLATORS: table header for an iSCSI targets table
    name: _("Interface"),
    value: (t: MergedTarget) => t.interface,
    sortingKey: "interface",
  },
  {
    // TRANSLATORS: table header for an iSCSI targets table
    name: _("Startup"),
    value: (t: MergedTarget) => {
      return t.startup;
    },
    sortingKey: "startup",
  },
  {
    // TRANSLATORS: table header for an iSCSI targets table
    name: _("Status"),
    value: (t: MergedTarget) => {
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

/**
 * Main component for displaying and managing iSCSI targets.
 *
 * Provides a filterable, sortable table of iSCSI targets with actions
 * to perform over them.
 */
export default function TargetsTable() {
  const [state, dispatch] = useReducer(reducer, initialState);
  const navigate = useNavigate();
  const configTargets = useConfig()?.targets || [];
  const systemTargets = useSystem()?.targets || [];
  const removeTarget = useRemoveTarget();

  const targets: MergedTarget[] = mergeSources<TargetToMerge, keyof TargetToMerge>({
    collections: {
      config: configTargets,
      system: systemTargets,
    },
    precedence: ["system", "config"],
    primaryKey: ["name", "address", "port"],
  });

  const hasLockedTargets = targets.find((t: MergedTarget) => "locked" in t && t.locked);

  const columns = createColumns();

  const onSortingChange = (sortedBy: SortedBy) => {
    dispatch({ type: "UPDATE_SORTING", payload: sortedBy });
  };

  const onFilterChange = (filter: keyof ISCSITargetsFilters, value: string) => {
    dispatch({ type: "UPDATE_FILTERS", payload: { [filter]: value } });
    dispatch({ type: "RESET_SELECTION" });
  };

  const onSelectionChange = (targets: MergedTarget[]) => {
    dispatch({ type: "UPDATE_SELECTION", payload: targets });
  };

  // Filtering
  const resetFilters = () => dispatch({ type: "RESET_FILTERS" });
  const filteredTargets = filterTargets(targets, state.filters);

  // Sorting
  const sortingKey = columns[state.sortedBy.index].sortingKey;
  const sortedTargets = sortCollection(filteredTargets, state.sortedBy.direction, sortingKey);

  // Determine the appropriate empty state mode, if needed
  let emptyStateMode: TargetsEmptyStateMode | undefined;
  if (isEmpty(filteredTargets)) {
    // Check if filters are at their initial values
    const filtersAreInitial =
      state.filters.name === initialState.filters.name &&
      state.filters.portal === initialState.filters.portal &&
      state.filters.status === initialState.filters.status;

    emptyStateMode = filtersAreInitial ? "noDevices" : "noFilterResults";
  }

  return (
    <Content>
      <FiltersToolbar filters={state.filters} onFilterChange={onFilterChange} />
      <Divider />
      <SelectableDataTable
        columns={columns}
        items={sortedTargets}
        selectionMode="none"
        itemsSelected={state.selectedTargets}
        variant="compact"
        onSelectionChange={onSelectionChange}
        sortedBy={state.sortedBy}
        updateSorting={onSortingChange}
        itemActions={(target: MergedTarget) =>
          buildActions(target, navigate, (n, a, p) => removeTarget(n, a, p))
        }
        itemActionsLabel={(t) =>
          sprintf(_("Actions for %s at portal %s"), t.name, `${t.address}:${t.port}`)
        }
        emptyState={
          emptyStateMode && <TargetsEmptyState mode={emptyStateMode} resetFilters={resetFilters} />
        }
      />
      {hasLockedTargets && (
        <HelperText>
          <HelperTextItem variant="indeterminate">
            {_("Locked targets cannot be managed from here and do not offer any actions.")}
          </HelperTextItem>
        </HelperText>
      )}
    </Content>
  );
}
