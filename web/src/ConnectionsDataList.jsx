/*
 * Copyright (c) [2022] SUSE LLC
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
import {
  Button,
  DataList,
  DataListItem,
  DataListCell,
  DataListItemRow,
  DataListItemCells
} from "@patternfly/react-core";

import {
  // EOS_LAN icon does not work
  EOS_ENDPOINTS_CONNECTED as EthernetIcon,
  EOS_WIFI as WifiIcon
} from "eos-icons-react";

import { CONNECTION_TYPES, formatIp } from "./client/network";

export default function ConnectionsDataList({ conns, onSelect }) {
  if (conns.length === 0) return null;

  const renderConnectionIcon = (connectionType) => {
    let Icon;

    switch (connectionType) {
      case CONNECTION_TYPES.ETHERNET:
        Icon = EthernetIcon;
        break;
      case CONNECTION_TYPES.WIFI:
        Icon = WifiIcon;
        break;
      default:
        Icon = () => null;
    }

    return <Icon size="16" />;
  };

  const renderConnectionId = (connection, onClick) => {
    if (typeof onClick !== "function") return connection.id;

    return (
      <Button variant="link" isInline onClick={() => onClick(connection)}>
        {connection.name}
      </Button>
    );
  };

  return (
    <DataList isCompact gridBreakpoint="none" className="connections-datalist">
      {conns.map(conn => {
        return (
          <DataListItem key={conn.id}>
            <DataListItemRow>
              <DataListItemCells
                dataListCells={[
                  <DataListCell key="connection-icon" isFilled={false}>
                    {renderConnectionIcon(conn.type)}
                  </DataListCell>,
                  <DataListCell key="connection-id" isFilled={false}>
                    {renderConnectionId(conn, onSelect)}
                  </DataListCell>,
                  <DataListCell key="connection-ips" isFilled={false} wrapModifier="truncate">
                    {conn.addresses.map(formatIp).join(", ")}
                  </DataListCell>
                ]}
              />
            </DataListItemRow>
          </DataListItem>
        );
      })}
    </DataList>
  );
}
