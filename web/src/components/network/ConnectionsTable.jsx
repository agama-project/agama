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
import { TableComposable, Thead, Tr, Th, Tbody, Td } from '@patternfly/react-table';
import { RowActions } from "~/components/core";
import { Icon } from "~/components/layout";
import { formatIp } from "~/client/network/utils";
import { _ } from "~/i18n";

import cockpit from "~/lib/cockpit";

/**
 * @typedef {import("~/client/network/model").Connection} Connection
 */

/**
 *
 * Displays given connections in a table
 * @component
 *
 * @param {object} props
 * @param {Connection[]} props.connections - Connections to be shown
 * @param {function} props.onEdit - function to be called for editing a connection
 * @param {function} props.onForget - function to be called for forgetting a connection
 */
export default function ConnectionsTable ({
  connections,
  onEdit,
  onForget
}) {
  if (connections.length === 0) return null;

  return (
    <TableComposable variant="compact">
      <Thead>
        <Tr>
          {/* TRANSLATORS: table header */}
          <Th width={25}>{_("Name")}</Th>
          {/* TRANSLATORS: table header */}
          <Th>{_("IP addresses")}</Th>
          <Th />
        </Tr>
      </Thead>
      <Tbody>
        { connections.map(connection => {
          const actions = [
            {
              title: _("Edit"),
              "aria-label":
                // TRANSLATORS: $0 is replaced by a network connection name
                cockpit.format(_("Edit connection $0"), connection.name),
              onClick: () => onEdit(connection)
            },
            typeof onForget === 'function' && {
              title: _("Forget"),
              "aria-label":
                // TRANSLATORS: $0 is replaced by a network connection name
                cockpit.format(_("Forget connection $0"), connection.name),
              className: "danger-action",
              icon: <Icon name="delete" size="24" />,
              onClick: () => onForget(connection)
            },
          ].filter(Boolean);

          return (
            <Tr key={connection.id}>
              <Td dataLabel="Name">{connection.name}</Td>
              <Td dataLabel="IP addresses">{connection.addresses.map(formatIp).join(", ")}</Td>
              <Td isActionCell>
                <RowActions
                  id={`actions-for-connection-${connection.id}`}
                  // TRANSLATORS: $0 is replaced by a network connection name
                  aria-label={cockpit.format(_("Actions for connection $0"), connection.name)}
                  actions={actions}
                  connection={connection}
                />
              </Td>
            </Tr>
          );
        })}
      </Tbody>
    </TableComposable>
  );
}
