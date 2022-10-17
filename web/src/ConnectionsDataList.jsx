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

import { formatIp } from "./client/network";

export default function ConnectionsDataList({ conns, onSelect }) {
  if (conns.length === 0) return null;

  const renderConnectionId = (conn, callback) => {
    if (!callback) return conn.id;

    return (
      <Button variant="link" isInline onClick={() => callback(conn)}>
        {conn.id}
      </Button>
    );
  };

  return (
    <DataList isCompact gridBreakpoint="none" className="connections-datalist">
      {conns.map(conn => (
        <DataListItem key={conn.path}>
          <DataListItemRow>
            <DataListItemCells
              dataListCells={[
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
      ))}
    </DataList>
  );
}
