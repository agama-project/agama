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
import { Icon } from "~/components/layout";
import { useInstallerClient } from "~/context/installer";
import { ConnectionTypes, NetworkEventTypes } from "~/client/network";
import { If, Page, Section } from "~/components/core";
import { ConnectionsTable, IpSettingsForm, NetworkPageOptions, WifiSelector } from "~/components/network";
import { _ } from "~/i18n";

/**
 * Internal component for displaying info when none wire connection is found
 * @component
 */
const NoWiredConnections = () => {
  return (
    <div className="stack">
      <div className="bold">{_("No wired connections found")}</div>
    </div>
  );
};

/**
 * Internal component for displaying info when none WiFi connection is found
 * @component
 *
 * @param {object} props
 * @param {boolean} props.supported - whether the system supports scanning WiFi networks
 * @param {boolean} props.openWifiSelector - the function for opening the WiFi selector
 */
const NoWifiConnections = ({ wifiScanSupported, openWifiSelector }) => {
  const message = wifiScanSupported
    ? _("The system has not been configured for connecting to a WiFi network yet.")
    : _("The system does not support WiFi connections, probably because of missing or disabled hardware.");

  return (
    <div className="stack">
      <div className="bold">{_("No WiFi connections found")}</div>
      <div>{message}</div>
      <If
        condition={wifiScanSupported}
        then={
          <>
            <Button
              variant="primary"
              onClick={openWifiSelector}
              icon={<Icon name="wifi_find" size="24" />}
            >
              {/* TRANSLATORS: button label */}
              {_("Connect to a Wi-Fi network")}
            </Button>
          </>
        }
      />
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
  const [wifiSelectorOpen, setWifiSelectorOpen] = useState(false);

  const openWifiSelector = () => setWifiSelectorOpen(true);
  const closeWifiSelector = () => setWifiSelectorOpen(false);

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

  const forgetConnection = async ({ id }) => {
    const connection = await client.getConnection(id);
    client.deleteConnection(connection);
  };

  const activeWiredConnections = connections.filter(c => c.type === ConnectionTypes.ETHERNET);
  const activeWifiConnections = connections.filter(c => c.type === ConnectionTypes.WIFI);

  const WifiConnections = () => {
    if (activeWifiConnections.length === 0) {
      return (
        <NoWifiConnections wifiScanSupported={wifiScanSupported} openWifiSelector={openWifiSelector} />
      );
    }

    return (
      <ConnectionsTable connections={activeWifiConnections} onEdit={selectConnection} onForget={forgetConnection} />
    );
  };

  const WiredConnections = () => {
    if (activeWiredConnections.length === 0) return <NoWiredConnections />;

    return <ConnectionsTable connections={activeWiredConnections} onEdit={selectConnection} />;
  };

  return (
    // TRANSLATORS: page title
    <Page title={_("Network")} icon="settings_ethernet" actionLabel="Back" actionVariant="secondary">
      { /* TRANSLATORS: page section */ }
      <Section title={_("Wired networks")} icon="lan">
        { ready ? <WiredConnections /> : <Skeleton /> }
      </Section>

      { /* TRANSLATORS: page section */ }
      <Section title={_("WiFi networks")} icon="wifi">
        { ready ? <WifiConnections /> : <Skeleton /> }
      </Section>

      <NetworkPageOptions wifiScanSupported={wifiScanSupported} openWifiSelector={openWifiSelector} />

      <If
        condition={wifiScanSupported}
        then={<WifiSelector isOpen={wifiSelectorOpen} onClose={closeWifiSelector} />}
      />

      { /* TODO: improve the connections edition */ }
      <If
        condition={selectedConnection}
        then={<IpSettingsForm connection={selectedConnection} onClose={() => setSelectedConnection(null)} />}
      />
    </Page>
  );
}
