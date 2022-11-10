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

import React, { useEffect, useState } from "react";
import { Button, Stack, StackItem } from "@patternfly/react-core";
import { useInstallerClient } from "./context/installer";
import { ConnectionTypes, NetworkEventTypes } from "./client/network";
import NetworkWiredStatus from "./NetworkWiredStatus";
import NetworkWifiStatus from "./NetworkWifiStatus";
import WirelessSelector from "./WirelessSelector";

export default function Network() {
  const client = useInstallerClient();
  const [initialized, setInitialized] = useState(false);
  const [connections, setConnections] = useState([]);
  const [settings, setSettings] = useState([]);
  const [accessPoints, setAccessPoints] = useState([]);
  const [openWirelessSelector, setOpenWirelessSelector] = useState(false);

  useEffect(() => {
    if (!initialized) return;

    setConnections(client.network.activeConnections());
    client.network.connections().then(setSettings);
  }, [client.network, initialized]);

  useEffect(() => {
    return client.network.onNetworkEvent(({ type, payload }) => {
      switch (type) {
        case NetworkEventTypes.ACTIVE_CONNECTION_ADDED: {
          setConnections(conns => [...conns, payload]);
          client.network.connections().then(setSettings);
          break;
        }

        case NetworkEventTypes.ACTIVE_CONNECTION_UPDATED: {
          setConnections(conns => {
            const newConnections = conns.filter(c => c.id !== payload.id);
            return [...newConnections, payload];
          });
          break;
        }

        case NetworkEventTypes.ACTIVE_CONNECTION_REMOVED: {
          setConnections(conns => conns.filter(c => c.id !== payload.id));
          client.network.connections().then(setSettings);
        }
      }
    });
  });

  useEffect(() => {
    client.network.setUp().then(() => setInitialized(true));
  }, [client.network]);

  useEffect(() => {
    if (!initialized) return;

    setAccessPoints(client.network.accessPoints());
  }, [client.network, initialized]);

  if (!initialized) return null;
  if (!connections.length) return null;

  const activeWiredConnections = connections.filter(c => c.type === ConnectionTypes.ETHERNET);
  const activeWifiConnections = connections.filter(c => c.type === ConnectionTypes.WIFI);

  return (
    <Stack className="overview-network">
      <StackItem>
        <NetworkWiredStatus connections={activeWiredConnections} />
      </StackItem>
      <StackItem>
        <NetworkWifiStatus connections={activeWifiConnections} />
      </StackItem>
      <StackItem>
        { accessPoints && accessPoints.length > 0 &&
          <Button variant="link" onClick={() => setOpenWirelessSelector(true)}>Connect to a wireless network</Button> }
        { openWirelessSelector &&
          <WirelessSelector activeConnections={activeWifiConnections} connections={settings} accessPoints={accessPoints} onClose={() => setOpenWirelessSelector(false)} /> }
      </StackItem>
    </Stack>
  );
}
