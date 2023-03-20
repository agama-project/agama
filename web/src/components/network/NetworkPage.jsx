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

import React, { useEffect, useState } from "react";
import { Button, Skeleton } from "@patternfly/react-core";

import { useInstallerClient } from "~/context/installer";
import { ConnectionTypes, NetworkEventTypes } from "~/client/network";
import { Page, Section } from "~/components/core";
import { ConnectionsTable, IpSettingsForm, WifiSelector } from "~/components/network";

/**
 * Internal component for displaying the WifiSelector when applicable
 * @component
 *
 * @param {object} props
 * @param {boolean} props.supported - whether the system supports scanning WiFi networks
 * @param {string} [buttonVariant="link"] - the PF4/Button variant prop for the button. See {@link https://www.patternfly.org/v4/components/button#props }
 */
const WifiScan = ({ supported, actionVariant = "link" }) => {
  const [wifiSelectorOpen, setWifiSelectorOpen] = useState(false);

  if (!supported) return null;

  return (
    <>
      <Button variant={actionVariant} onClick={() => setWifiSelectorOpen(true)}>Connect to a Wi-Fi network</Button>
      <WifiSelector isOpen={wifiSelectorOpen} onClose={() => setWifiSelectorOpen(false)} />
    </>
  );
};

/**
 * Internal component for displaying info when none wire connection is found
 * @component
 */
const NoWiredConnections = () => {
  return (
    <div className="stack">
      <div className="bold">No wired connections found</div>
    </div>
  );
};

/**
 * Internal component for displaying info when none WiFi connection is found
 * @component
 *
 * @param {object} props
 * @param {boolean} props.supported - whether the system supports scanning WiFi networks
 */
const NoWifiConnections = ({ wifiScanSupported }) => {
  const message = wifiScanSupported
    ? "The system has not been configured for connecting to a WiFi network yet."
    : "The system does not support WiFi connections, probably because of missing or disabled hardware.";

  return (
    <div className="stack">
      <div className="bold">No WiFi connections found</div>
      <div>{message}</div>
      <WifiScan supported={wifiScanSupported} buttonVariant="primary" />
    </div>
  );
};

/**
 * Page component holding Network settings
 * @component
 */
export default function NetworkPage() {
  const { network: client } = useInstallerClient();
  const [initialized, setInitialized] = useState(false);
  const [ready, setReady] = useState(false);
  const [connections, setConnections] = useState([]);
  const [selectedConnection, setSelectedConnection] = useState(null);
  const [wifiScanSupported, setWifiScanSupported] = useState(false);

  useEffect(() => {
    client.setUp().then(() => setInitialized(true));
  }, [client]);

  useEffect(() => {
    if (!initialized) return;

    setWifiScanSupported(client.settings().wifiScanSupported);
    setConnections(client.activeConnections());
    setReady(true);
  }, [client, initialized]);

  useEffect(() => {
    return client.onNetworkEvent(({ type, payload }) => {
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

  const selectConnection = ({ id }) => {
    client.getConnection(id).then(setSelectedConnection);
  };

  const activeWiredConnections = connections.filter(c => c.type === ConnectionTypes.ETHERNET);
  const activeWifiConnections = connections.filter(c => c.type === ConnectionTypes.WIFI);

  const WifiConnections = () => {
    if (activeWifiConnections.length === 0) {
      return <NoWifiConnections wifiScanSupported={wifiScanSupported} />;
    }

    return (
      <>
        <ConnectionsTable connections={activeWifiConnections} onEdit={selectConnection} />
        <div className="horizontally-centered">
          <WifiScan supported={wifiScanSupported} />
        </div>
      </>
    );
  };

  const WiredConnections = () => {
    if (activeWiredConnections.length === 0) return <NoWiredConnections />;

    return <ConnectionsTable connections={activeWiredConnections} onEdit={selectConnection} />;
  };

  return (
    <Page title="Network" icon="settings_ethernet" actionLabel="Back" actionVariant="secondary">
      <Section title="Wired networks" icon="lan">
        { ready ? <WiredConnections /> : <Skeleton /> }
      </Section>

      <Section title="WiFi networks" icon="wifi">
        { ready ? <WifiConnections /> : <Skeleton /> }
      </Section>

      { /* TODO: improve the connections edition */ }
      { selectedConnection && <IpSettingsForm connection={selectedConnection} onClose={() => setSelectedConnection(null)} /> }
    </Page>
  );
}
