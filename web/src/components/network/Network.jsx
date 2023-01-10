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
import { Button } from "@patternfly/react-core";

import { useInstallerClient } from "@context/installer";
import { ConnectionTypes, NetworkEventTypes } from "@client/network";
import { NetworkWifiStatus, NetworkWiredStatus, WifiSelector } from "@components/network";

export default function Network() {
  const client = useInstallerClient();
  const [initialized, setInitialized] = useState(false);
  const [connections, setConnections] = useState([]);
  const [wifiScanSupported, setWifiScanSupported] = useState(false);

  useEffect(() => {
    if (!initialized) return;

    setWifiScanSupported(client.network.settings().wifiScanSupported);
    setConnections(client.network.activeConnections());
  }, [client.network, initialized]);

  useEffect(() => {
    return client.network.onNetworkEvent(({ type, payload }) => {
      switch (type) {
        case NetworkEventTypes.ACTIVE_CONNECTION_ADDED: {
          setConnections(conns => {
            const newConnections = conns.filter(c => c.id !== payload.id);
            return [...newConnections, payload];
          });
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
          break;
        }

        case NetworkEventTypes.SETTINGS_UPDATED: {
          setWifiScanSupported(payload.wifiScanSupported);
        }
      }
    });
  });

  useEffect(() => {
    client.network.setUp().then(() => setInitialized(true));
  }, [client.network]);

  if (!initialized) return null;

  const activeWiredConnections = connections.filter(c => c.type === ConnectionTypes.ETHERNET);
  const activeWifiConnections = connections.filter(c => c.type === ConnectionTypes.WIFI);
  const showNetwork = (activeWiredConnections.length > 0 || activeWifiConnections.length > 0);

  const Content = () => {
    if (!showNetwork) {
      return "No network connection was detected";
    }

    return (
      <>
        <NetworkWiredStatus connections={activeWiredConnections} />
        <NetworkWifiStatus connections={activeWifiConnections} />
      </>
    );
  };

  const WifiOptions = () => {
    const [wifiSelectorOpen, setWifiSelectorOpen] = useState(false);

    return (
      <>
        <Button variant="link" onClick={() => setWifiSelectorOpen(true)}>Connect to a Wi-Fi network</Button>
        <WifiSelector isOpen={wifiSelectorOpen} onClose={() => setWifiSelectorOpen(false)} />
      </>
    );
  };

  return (
    <>
      <Content />
      { wifiScanSupported && <WifiOptions /> }
    </>
  );
}
