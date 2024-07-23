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
import { useNavigate, generatePath } from "react-router-dom";
import { Table, Thead, Tr, Th, Tbody, Td } from "@patternfly/react-table";
import { RowActions } from "~/components/core";
import { Icon } from "~/components/layout";
import { formatIp } from "~/client/network/utils";
import { PATHS } from "~/routes/network";
import { sprintf } from "sprintf-js";
import { _ } from "~/i18n";

/**
 * @typedef {import("~/client/network/model").Device} Device
 * @typedef {import("~/client/network/model").Connection} Connection
 */

/**
 *
 * Displays given connections in a table
 * @component
 *
 * @param {object} props
 * @param {Connection[]} props.connections - Connections to be shown
 * @param {Device[]} props.devices - Connections to be shown
 * @param {function} [props.onForget] - function to be called for forgetting a connection
 */
export default function ConnectionsTable({ connections, devices, onForget }) {
  const navigate = useNavigate();
  if (connections.length === 0) return null;

  const connectionDevice = ({ id }) => devices.find(({ connection }) => id === connection);
  const connectionAddresses = (connection) => {
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
}
