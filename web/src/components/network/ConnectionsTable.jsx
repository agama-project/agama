/*
 * Copyright (c) [2023] SUSE LLC
 *
 * All Rights Reserved.
 *
 * This program is free software; you can redistribute it and/or modify it
 * under the terms of version 2 of the GNU General Public License as published
 * by the Free Software Foundation.
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
import { TableComposable, Thead, Tr, Th, Tbody, Td, ActionsColumn } from '@patternfly/react-table';
import { DropdownToggle } from "@patternfly/react-core";
import { Icon } from "~/components/layout";
import { formatIp } from "~/client/network/utils";

/**
 * @typedef {import("~/client/network/model").Connection} Connection
 */

// TODO: extract to a common component since it's used in other tables (or stop using a custom toggler)
const RowActions = ({ actions, connection, ...props }) => {
  const actionsToggle = (props) => (
    <DropdownToggle
      id={`actions-for-connection-${connection.id}`}
      toggleIndicator={null}
      isDisabled={props.isDisabled}
      onToggle={props.onToggle}
      aria-label={`Actions for connection ${connection.name}`}
    >
      <Icon name="more_vert" size="24" />
    </DropdownToggle>
  );

  return (
    <ActionsColumn
      items={actions}
      actionsToggle={actionsToggle}
      {...props}
    />
  );
};

/**
 *
 * Displays given connections in a table
 * @component
 *
 * @param {object} props
 * @param {Connection[]} props.connections - Connections to be shown
 * @param {function} props.onEdit - function to be called for editing a connection
 */
export default function ConnectionsTable ({
  connections,
  onEdit
}) {
  if (connections.length === 0) return null;

  return (
    <TableComposable gridBreakPoint="grid-sm" variant="compact">
      <Thead>
        <Tr>
          <Th width={25}>Name</Th>
          <Th>Ip addresses</Th>
          <Th />
        </Tr>
      </Thead>
      <Tbody>
        { connections.map(connection => {
          const actions = [
            {
              title: "Edit",
              "aria-label": `Edit connection ${connection.name}`,
              onClick: () => onEdit(connection)
            }
          ];

          return (
            <Tr key={connection.id}>
              <Td>{connection.name}</Td>
              <Td>{connection.addresses.map(formatIp).join(", ")}</Td>
              <Td isActionCell>
                <RowActions actions={actions} connection={connection} />
              </Td>
            </Tr>
          );
        })}
      </Tbody>
    </TableComposable>
  );
}
