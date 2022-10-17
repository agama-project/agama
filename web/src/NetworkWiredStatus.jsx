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

import React, { useState } from "react";
import { Text } from "@patternfly/react-core";
import IpSettingsForm from "./IpSettingsForm";
import ConnectionsDataList from "./ConnectionsDataList";

import { CONNECTION_STATE } from "./client/network";

export default function NetworkWiredStatus({ connections }) {
  const [connection, setConnection] = useState(null);

  const conns = connections.filter(c => c.state === CONNECTION_STATE.ACTIVATED);

  return (
    <>
      <Text>{conns.length ? "Wired connected:" : "Wired not connected"}</Text>

      <ConnectionsDataList conns={conns} onSelect={setConnection} />
      { connection && <IpSettingsForm connection={connection} onClose={() => setConnection(null)} /> }
    </>
  );
}
