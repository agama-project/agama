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
import { useDevices, useSystem } from "~/hooks/model/system/network";
import { sortCollection } from "~/utils";
import { formatIp } from "~/utils/network";
import { _ } from "~/i18n";
import { Connection, ConnectionStatus, Device } from "~/types/network";
import { NETWORK } from "~/routes/paths";

/**
 * Filter options for narrowing down network connections shown in the table.
 */
type ConnectionsFilters = {
  name?: string;
  device?: string;
  type?: "all" | "wifi" | "ethernet";
  status?: "all" | "up" | "down";
  bind?: "all" | "interface" | "mac";
};

/** Internal state shape for the connections table component. */
type TableState = {
  /** Current sorting state */
  sortedBy: SortedBy;
  /** Current active filters applied to the connection list */
  filters: ConnectionsFilters;
};

const initialState: TableState = {
  sortedBy: { index: 0, direction: "asc" },
  filters: {
    name: "",
    device: "",
    type: "all",
    status: "all",
    bind: "all",
  },
};

type TableAction =
  | { type: "UPDATE_SORTING"; payload: TableState["sortedBy"] }
  | { type: "UPDATE_FILTERS"; payload: TableState["filters"] }
  | { type: "RESET_FILTERS" };

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

const filterConnections = (
  connections: Connection[],
  filters: ConnectionsFilters,
): Connection[] => {
  const { name, device, type, status, bind } = filters;

  return connections.filter((c) => {
    if (!isEmpty(name) && !c.id.toLowerCase().includes(name.toLowerCase())) {
      return false;
    }
    if (
      !isEmpty(device) &&
      !(c.iface || c.macAddress || "").toLowerCase().includes(device.toLowerCase())
    ) {
      return false;
    }
    if (type && type !== "all") {
      const isWifi = !!c.wireless;
      if (type === "wifi" && !isWifi) return false;
      if (type === "ethernet" && isWifi) return false;
    }
    if (status && status !== "all") {
      const isUp = c.status === ConnectionStatus.UP;
      if (status === "up" && !isUp) return false;
      if (status === "down" && isUp) return false;
    }
    if (bind && bind !== "all") {
      if (bind === "interface" && isEmpty(c.iface)) return false;
      if (bind === "mac" && isEmpty(c.macAddress)) return false;
    }
    return true;
  });
};

const createColumns = (devices: Device[]) => [
  {
    name: _("Name"),
    value: (c: Connection) => c.id,
    sortingKey: (c: Connection) => c.id,
  },
  {
    name: _("Type"),
    value: (c: Connection) => (c.wireless ? _("Wi-Fi") : _("Ethernet")),
    sortingKey: (c: Connection) => (c.wireless ? "wifi" : "ethernet"),
  },
  {
    name: _("Status"),
    value: (c: Connection) => (c.status === ConnectionStatus.UP ? _("Up") : _("Down")),
    sortingKey: (c: Connection) => c.status,
  },
  {
    name: _("Bind"),
    value: (c: Connection) => {
      if (!isEmpty(c.iface)) {
        return _("by interface");
      }
      if (!isEmpty(c.macAddress)) {
        return _("by MAC");
      }
      return "";
    },
  },
  {
    name: _("Device"),
    value: (c: Connection) => {
      const usingDevices = devices.filter((d) => d.connection === c.id);
      return usingDevices.map((d) => d.name).join(", ") || "-";
    },
    sortingKey: (c: Connection) => {
      const usingDevices = devices.filter((d) => d.connection === c.id);
      return usingDevices.map((d) => d.name).join(", ");
    },
  },
  {
    name: _("IP Addresses"),
    value: (c: Connection) => {
      const device = devices.find((d) => d.connection === c.id);
      const addresses = device ? device.addresses : c.addresses;
      return addresses.map(formatIp).join(", ") || "-";
    },
  },
];

export default function ConnectionsTable() {
  const [state, dispatch] = useReducer(reducer, initialState);
  const connections = useConnections();
  const devices = useDevices();
  const { state: systemState } = useSystem();
  const { mutateAsync: mutateConnection } = useConnectionMutation();
  const navigate = useNavigate();

  const columns = createColumns(devices);

  const onSortingChange = (sortedBy: SortedBy) => {
    dispatch({ type: "UPDATE_SORTING", payload: sortedBy });
  };

  const onFilterChange = (filter: keyof ConnectionsFilters, value) => {
    dispatch({ type: "UPDATE_FILTERS", payload: { [filter]: value } });
  };

  const resetFilters = () => dispatch({ type: "RESET_FILTERS" });

  const upConnection = (connection: Connection) => {
    const conn = new Connection(connection.id, {
      ...connection,
      status: ConnectionStatus.UP,
    });
    mutateConnection(conn);
  };

  const downConnection = (connection: Connection) => {
    const conn = new Connection(connection.id, {
      ...connection,
      status: ConnectionStatus.DOWN,
    });
    mutateConnection(conn);
  };

  const deleteConnection = (connection: Connection) => {
    const toDelete = new Connection(connection.id, {
      ...connection,
      status: ConnectionStatus.DELETE,
    });
    mutateConnection(toDelete);
  };

  const filteredConnections = filterConnections(connections, state.filters);
  const sortedConnections = sortCollection(
    filteredConnections,
    state.sortedBy.direction,
    columns[state.sortedBy.index].sortingKey,
  );

  const hasActiveFilters = JSON.stringify(state.filters) !== JSON.stringify(initialState.filters);

  const countText = hasActiveFilters
    ? sprintf(
        // TRANSLATORS: shown in the filter toolbar when filters are active.
        // %1$s is the number of matching connections, %2$s is the total number.
        _("%1$d of %2$d connections match filters"),
        filteredConnections.length,
        connections.length,
      )
    : sprintf(
        // TRANSLATORS: shown in the filter toolbar when no filters are active.
        // %s is the total number of connections.
        _("%d connections available"),
        connections.length,
      );

  return (
    <Content>
      <Toolbar>
        <ToolbarContent alignItems="center">
          <ToolbarGroup>
            <ToolbarItem>
              <TextinputFilter
                id="connection-name"
                label={_("Name")}
                value={state.filters.name}
                width="150px"
                onChange={(_, v) => onFilterChange("name", v)}
              />
            </ToolbarItem>
            <ToolbarItem>
              <SimpleSelector
                label={_("Type")}
                value={state.filters.type}
                options={{
                  all: _("All"),
                  wifi: _("Wi-Fi"),
                  ethernet: _("Ethernet"),
                }}
                onChange={(_, v) => onFilterChange("type", v)}
              />
            </ToolbarItem>
            <ToolbarItem>
              <SimpleSelector
                label={_("Status")}
                value={state.filters.status}
                options={{
                  all: _("All"),
                  up: _("Up"),
                  down: _("Down"),
                }}
                onChange={(_, v) => onFilterChange("status", v)}
              />
            </ToolbarItem>
            <ToolbarItem>
              <SimpleSelector
                label={_("Bind")}
                value={state.filters.bind}
                options={{
                  all: _("All"),
                  interface: _("by interface"),
                  mac: _("by MAC"),
                }}
                onChange={(_, v) => onFilterChange("bind", v)}
              />
            </ToolbarItem>
          </ToolbarGroup>
          <ToolbarGroup align={{ default: "alignEnd" }}>
            <ToolbarItem>
              <Text textStyle="textColorSubtle">{countText}</Text>
            </ToolbarItem>
            {hasActiveFilters && (
              <ToolbarItem>
                <Button variant="link" isInline onClick={resetFilters}>
                  {_("Clear all filters")}
                </Button>
              </ToolbarItem>
            )}
          </ToolbarGroup>
        </ToolbarContent>
      </Toolbar>

      <Divider />

      <SelectableDataTable
        columns={columns}
        items={sortedConnections}
        itemIdKey="id"
        selectionMode="none"
        variant="compact"
        sortedBy={state.sortedBy}
        updateSorting={onSortingChange}
        itemActions={(c: Connection) => {
          const isWifi = !!c.wireless;
          const canConnect = !isWifi || systemState.wirelessEnabled;

          const actions = [
            {
              id: "details",
              title: _("Details"),
              onClick: () => {
                // FIXME: create a shared connection page and route
                navigate(generatePath(NETWORK.wiredConnection, { id: c.id }));
              },
            },
            {
              id: "edit",
              title: _("Edit"),
              onClick: () => navigate(generatePath(NETWORK.editConnection, { id: c.id })),
            },
            {
              id: "separator",
              isSeparator: true,
            },
            {
              id: "connect",
              title: _("Set up"),
              onClick: () => upConnection(c),
            },
            {
              id: "disconnect",
              title: _("Set down"),
              onClick: () => downConnection(c),
            },
            {
              id: "separator2",
              isSeparator: true,
            },
            {
              id: "delete",
              title: _("Delete"),
              isDanger: true,
              onClick: () => deleteConnection(c),
            },
          ];

          const keptActions = {
            connect: c.status === ConnectionStatus.DOWN && canConnect,
            disconnect: c.status === ConnectionStatus.UP,
            separator: true,
            separator2: true,
            details: true,
            edit: true,
            delete: true,
          };

          return actions.filter((a) => keptActions[a.id]);
        }}
        itemActionsLabel={(c: Connection) => `Actions for ${c.id}`}
        emptyState={
          <EmptyState
            headingLevel="h2"
            titleText={_("No connections match filters")}
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
