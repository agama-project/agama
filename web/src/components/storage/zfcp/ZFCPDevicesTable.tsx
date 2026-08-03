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

import React from "react";
import { identity, zipToObject } from "radashi";
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
import SelectableDataTable from "~/components/core/SelectableDataTable";
import SimpleSelector from "~/components/core/SimpleSelector";
import { sortCollection, translateEntries } from "~/utils";
import { _, N_ } from "~/i18n";
import useSortedByParam from "~/hooks/use-sorted-by-param";
import useFilterParams, { choiceFilter } from "~/hooks/use-filter-params";
import { ZFCP_SORT } from "~/components/storage/ui-state-params";
import { useCheckLunScan } from "~/hooks/model/system/zfcp";
import { useAddDevices, useRemoveDevices, useConfig } from "~/hooks/model/config/zfcp";
import type { ZFCP as System } from "~/model/system";
import type { ZFCP as Config } from "~/model/config";
import type { CheckLunScanFn } from "~/hooks/model/system/zfcp";
import type { AddDevicesFn, RemoveDevicesFn } from "~/hooks/model/config/zfcp";

/**
 * Possible statuses of a zFCP device.
 */
const STATUS_OPTIONS = {
  activated: N_("Activated"),
  deactivated: N_("Deactivated"),
};

/**
 * Filter options for narrowing down zFCP devices shown in the table.
 *
 * All filters are optional and may be combined.
 */
export type ZFCPDevicesFilters = {
  /** Only show devices with this status. */
  status?: "all" | "activated" | "deactivated";
  /** Channel ID filtering. */
  channel?: "all" | string;
  /** WWPN filtering. */
  wwpn?: "all" | string;
};

/**
 * Predicate function for evaluating whether a zFCP device meets a given condition.
 *
 * Used internally to compose filter logic when narrowing down the list of devices shown in the
 * table.
 */
type ZFCPDeviceCondition = (device: System.Device) => boolean;

/**
 * Filters an array of devices based on given filters.
 *
 * @param devices - The array of zFCP devices to filter.
 * @param filters - The filters to apply.
 * @returns The filtered array of zFCP devices matching all the conditions.
 */
const filterDevices = (devices: System.Device[], filters: ZFCPDevicesFilters): System.Device[] => {
  const { status, channel, wwpn } = filters;
  const conditions: ZFCPDeviceCondition[] = [];

  if (status && status !== "all") {
    conditions.push((d: System.Device): boolean => (status === "activated" ? d.active : !d.active));
  }

  if (channel && channel !== "all") {
    conditions.push((c: System.Device): boolean => c.channel === channel);
  }

  if (wwpn && wwpn !== "all") {
    conditions.push((c: System.Device): boolean => c.wwpn === wwpn);
  }

  return devices.filter((device) => conditions.every((conditionFn) => conditionFn(device)));
};

type FiltersToolbarProps = {
  /** Currently active filter values. */
  filters: ZFCPDevicesFilters;
  /** Whether any filter differs from its default value. */
  hasActiveFilters: boolean;
  /** Total number of devices before filtering. */
  totalDevices: number;
  /** Number of devices that pass the current filters. */
  matchingDevices: number;
  /** All available channels for selection. */
  channels: string[];
  /** All available WWPNs fo selection. */
  wwpns: string[];
  /** Callback invoked when a single filter value changes. */
  onFilterChange: (filter: keyof ZFCPDevicesFilters, value: string | number) => void;
  /** Callback invoked when all filters should be reset to their defaults. */
  onReset: () => void;
};

/**
 * Renders the filter controls toolbar for the zFCP table.
 *
 * Displays status, channel and WWPN range filters alongside a device count summary. When any filter
 * is active the count switches from "N devices available" to "M of N devices match filters" and a
 * "Clear all filters" link appears.
 */
const FiltersToolbar = ({
  filters,
  hasActiveFilters,
  totalDevices,
  matchingDevices,
  channels,
  wwpns,
  onFilterChange,
  onReset,
}: FiltersToolbarProps): React.ReactNode => {
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
                ...translateEntries(STATUS_OPTIONS),
              }}
              onChange={(_, v) => onFilterChange("status", v)}
            />
            <SimpleSelector
              label={_("Channel")}
              value={filters.channel}
              options={{
                all: _("All"),
                ...zipToObject(channels, identity),
              }}
              onChange={(_, v) => onFilterChange("channel", v)}
            />
            <SimpleSelector
              label={_("WWPN")}
              value={filters.wwpn}
              options={{
                all: _("All"),
                ...zipToObject(wwpns, identity),
              }}
              onChange={(_, v) => onFilterChange("wwpn", v)}
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
 * Builds the list of actions available for the given zFCP device.
 */
const buildActions = (
  device: System.Device,
  config: Config.Device | null,
  addDevices: AddDevicesFn,
  removeDevices: RemoveDevicesFn,
  checkLunScan: CheckLunScanFn,
) => {
  const failedActivate = config && (config.active === undefined || config.active) && !device.active;

  const failedDeactivate = config && config.active === false && device.active;

  const actions = [
    {
      id: "activate",
      title: failedActivate ? _("Try to activate again") : _("Activate"),
      onClick: () =>
        addDevices([{ channel: device.channel, wwpn: device.wwpn, lun: device.lun, active: true }]),
    },
    {
      id: "deactivate",
      title: failedDeactivate ? _("Try to deactivate again") : _("Deactivate"),
      onClick: () =>
        addDevices([
          { channel: device.channel, wwpn: device.wwpn, lun: device.lun, active: false },
        ]),
    },
    {
      id: "remove",
      title: failedActivate ? _("Do not activate") : _("Do not deactivate"),
      onClick: () =>
        removeDevices([{ channel: device.channel, wwpn: device.wwpn, lun: device.lun }]),
    },
  ];

  const keptActions = {
    activate: !device.active,
    deactivate: device.active && !checkLunScan(device.channel),
    remove: failedActivate || failedDeactivate,
  };

  return actions.filter((a) => keptActions[a.id]);
};

/**
 * Column definitions for the zFCP devices table.
 *
 * Each entry defines the column header label, how its value is derived from a device, and which
 * field drives sorting. Consumed by `SelectableDataTable`.
 */
const createColumns = (checkLunScan: CheckLunScanFn) => [
  {
    // TRANSLATORS: table header for a zFCP devices table.
    name: _("Channel"),
    value: (d: System.Device) => d.channel,
    sortingKey: "channel",
  },
  {
    // TRANSLATORS: table header for a zFCP devices table.
    name: _("WWPN"),
    value: (d: System.Device) => d.wwpn,
    sortingKey: "wwpn",
  },
  {
    // TRANSLATORS: table header for a zFCP devices table.
    name: _("LUN"),
    value: (d: System.Device) => d.lun,
    sortingKey: "lun",
  },
  {
    // TRANSLATORS: table header for a zFCP devices table.
    name: _("Status"),
    value: (d: System.Device) => _(STATUS_OPTIONS[d.active ? "activated" : "deactivated"]),
    sortingKey: "active",
  },
  {
    // TRANSLATORS: table header for a zFCP devices table.
    name: _("Device"),
    value: (d: System.Device) => d.deviceName,
    sortingKey: "deviceName",
  },
  {
    // TRANSLATORS: table header for a zFCP devices table.
    name: _("Auto Scanned"),
    value: (d: System.Device) => (checkLunScan(d.channel) ? _("Yes") : _("No")),
  },
];

type ZFCPDevicesTableProps = {
  devices: System.Device[];
};

/**
 * Renders a table for configuring zFCP devices.
 *
 * Filters and sorting live in the URL, so reloading the page or sharing its
 * address brings the same view back.
 */
export default function ZFCPDevicesTable({ devices }: ZFCPDevicesTableProps): React.ReactNode {
  const addDevices = useAddDevices();
  const removeDevices = useRemoveDevices();
  const checkLunScan = useCheckLunScan();
  const config = useConfig();

  const columns = createColumns(checkLunScan);
  const [sortedBy, updateSorting] = useSortedByParam(columns, {
    param: ZFCP_SORT,
    defaultValue: { index: 0, direction: "asc" },
  });

  const { filters, setFilter, resetFilters, hasActiveFilters } = useFilterParams({
    status: choiceFilter(["activated", "deactivated"] as const),
    channel: choiceFilter(devices.map((d) => d.channel)),
    wwpn: choiceFilter(devices.map((d) => d.wwpn)),
  });

  const onFilterChange = (filter: keyof ZFCPDevicesFilters, value: string) =>
    setFilter(filter, value);

  // Filtering
  const filteredDevices = filterDevices(devices, filters);

  // Sorting
  const sortingKey = columns[sortedBy.index].sortingKey;
  const sortedDevices = sortCollection(filteredDevices, sortedBy.direction, sortingKey);

  const deviceConfig = (device: System.Device): Config.Device | null => {
    return config?.devices?.find(
      (c) => c.channel === device.channel && c.wwpn === device.wwpn && device.lun === c.lun,
    );
  };

  return (
    <Content>
      <FiltersToolbar
        filters={filters}
        hasActiveFilters={hasActiveFilters}
        totalDevices={devices.length}
        matchingDevices={filteredDevices.length}
        channels={devices.map((d) => d.channel)}
        wwpns={devices.map((d) => d.wwpn)}
        onFilterChange={onFilterChange}
        onReset={resetFilters}
      />

      <SelectableDataTable
        columns={columns}
        items={sortedDevices}
        selectionMode="none"
        variant="compact"
        sortedBy={sortedBy}
        updateSorting={updateSorting}
        itemActions={(device: System.Device) =>
          buildActions(device, deviceConfig(device), addDevices, removeDevices, checkLunScan)
        }
        itemActionsLabel={(d: System.Device) =>
          // TRANSLATORS: accessible label for the connection actions toggle
          // button. %s is replaced with the zFCP LUN, e.g. "Actions for
          // 0x4010403200000000"
          sprintf(_("Actions for %s"), d.lun)
        }
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
