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
import { Text } from "@patternfly/react-core";
import { CONNECTION_STATE } from "./client/network";

import ConnectionsDataList from "./ConnectionsDataList";

export default function NetworkWiFiStatus({ connections }) {
  const conns = connections.filter(c => c.state === CONNECTION_STATE.ACTIVATED);

  return (
    <>
      <Text>{conns.length ? "WiFi connected:" : "WiFi not connected"}</Text>
      <ConnectionsDataList conns={conns} />
    </>
  );
}
