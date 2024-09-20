/*
 * Copyright (c) [2023-2024] SUSE LLC
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
import { useNavigate, generatePath } from "react-router-dom";
import { Table, Thead, Tr, Th, Tbody, Td } from "@patternfly/react-table";
import { RowActions } from "~/components/core";
import { Icon } from "~/components/layout";
import { PATHS } from "~/routes/network";
import { Connection, Device } from "~/types/network";
import { formatIp } from "~/utils/network";
import { sprintf } from "sprintf-js";
import { _ } from "~/i18n";

type ConnectionsTableProps = {
  connections: Connection[];
  devices: Device[];
  onForget?: (connection: Connection) => void;
};

/**
 *
 * Displays given connections in a table
 *
 */
const ConnectionsTable = ({
  connections,
  devices,
  onForget,
}: ConnectionsTableProps): React.ReactNode => {
  const navigate = useNavigate();
  if (connections.length === 0) return null;

  const connectionDevice = ({ id }) => devices.find(({ connection }) => id === connection);
  const connectionAddresses = (connection: Connection) => {
    const device = connectionDevice(connection);
    const addresses = device ? device.addresses : connection.addresses;

    return addresses?.map(formatIp).join(", ");
  };

  return (
    <Table variant="compact">
      <Thead>
        <Tr>
          {/* TRANSLATORS: table header */}
          <Th width={25}>{_("Name")}</Th>
          {/* TRANSLATORS: table header */}
          <Th>{_("IP addresses")}</Th>
          {/* TRANSLATORS: table header aria label */}
          <Th aria-label={_("Connection actions")} />
        </Tr>
      </Thead>
      <Tbody>
        {connections.map((connection) => {
          const actions = [
            {
              title: _("Edit"),
              role: "link",
              // TRANSLATORS: %s is replaced by a network connection name
              "aria-label": sprintf(_("Edit connection %s"), connection.id),
              onClick: () => navigate(generatePath(PATHS.editConnection, { id: connection.id })),
            },
            typeof onForget === "function" && {
              title: _("Forget"),
              // TRANSLATORS: %s is replaced by a network connection name
              "aria-label": sprintf(_("Forget connection %s"), connection.id),
              icon: <Icon name="delete" size="s" />,
              onClick: () => onForget(connection),
              isDanger: true,
            },
          ].filter(Boolean);

          return (
            <Tr key={connection.id}>
              <Td dataLabel={_("Name")}>{connection.id}</Td>
              <Td dataLabel={_("IP addresses")}>{connectionAddresses(connection)}</Td>
              <Td isActionCell>
                <RowActions
                  id={`actions-for-connection-${connection.id}`}
                  // TRANSLATORS: %s is replaced by a network connection name
                  aria-label={sprintf(_("Actions for connection %s"), connection.id)}
                  actions={actions}
                />
              </Td>
            </Tr>
          );
        })}
      </Tbody>
    </Table>
  );
};

export default ConnectionsTable;
