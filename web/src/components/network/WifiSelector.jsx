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

import { useInstallerClient } from "~/context/installer";
import { NetworkEventTypes } from "~/client/network";
import { Popup } from "~/components/core";
import { WifiNetworksList } from "~/components/network";
import { _ } from "~/i18n";

const networksFromValues = (networks) => Object.values(networks).flat();
const baseHiddenNetwork = { ssid: undefined, hidden: true };

function WifiSelector({ isOpen = false, onClose }) {
  const client = useInstallerClient();
  const [networks, setNetworks] = useState([]);
  const [showHiddenForm, setShowHiddenForm] = useState(false);
  const [connections, setConnections] = useState([]);
  const [activeConnections, setActiveConnections] = useState(client.network.activeConnections());
  const [selectedNetwork, setSelectedNetwork] = useState(null);
  const [activeNetwork, setActiveNetwork] = useState(null);

  const switchSelectedNetwork = (network) => {
    setShowHiddenForm(network === baseHiddenNetwork);
    setSelectedNetwork(network);
  };

  useEffect(() => {
    client.network.connections().then(setConnections);
  }, [client.network]);

  useEffect(() => {
    const loadNetworks = async () => {
      const knownSsids = [];

      return client.network.accessPoints()
        .sort((a, b) => b.strength - a.strength)
        .reduce((networks, ap) => {
          // Do not include networks without SSID
          if (!ap.ssid || ap.ssid === "") return networks;
          // Do not include "duplicates"
          if (knownSsids.includes(ap.ssid)) return networks;

          const network = {
            ...ap,
            settings: connections.find(c => c.wireless?.ssid === ap.ssid),
            connection: activeConnections.find(c => c.id === ap.ssid)
          };

          // Group networks
          if (network.connection) {
            networks.connected.push(network);
          } else if (network.settings) {
            networks.configured.push(network);
          } else {
            networks.others.push(network);
          }

          knownSsids.push(network.ssid);

          return networks;
        }, { connected: [], configured: [], others: [] });
    };

    loadNetworks().then((data) => {
      setNetworks(data);
      setActiveNetwork(networksFromValues(data).find(d => d.connection));
    });
  }, [client.network, connections, activeConnections, isOpen]);

  useEffect(() => {
    return client.network.onNetworkEvent(({ type, payload }) => {
      switch (type) {
        case NetworkEventTypes.CONNECTION_ADDED: {
          setConnections(conns => [...conns, payload]);
          break;
        }

        case NetworkEventTypes.CONNECTION_UPDATED: {
          setConnections(conns => {
            const newConnections = conns.filter(c => c.id !== payload.id);
            return [...newConnections, payload];
          });
          break;
        }

        case NetworkEventTypes.CONNECTION_REMOVED: {
          setConnections(conns => conns.filter(c => c.path !== payload.path));
          break;
        }

        case NetworkEventTypes.ACTIVE_CONNECTION_ADDED: {
          setActiveConnections(conns => [...conns, payload]);
          break;
        }

        case NetworkEventTypes.ACTIVE_CONNECTION_UPDATED: {
          setActiveConnections(conns => {
            const newConnections = conns.filter(c => c.id !== payload.id);
            return [...newConnections, payload];
          });
          break;
        }

        case NetworkEventTypes.ACTIVE_CONNECTION_REMOVED: {
          setActiveConnections(conns => conns.filter(c => c.id !== payload.id));
          if (selectedNetwork?.settings?.id === payload.id) switchSelectedNetwork(null);
          break;
        }
      }
    });
  });

  return (
    <Popup isOpen={isOpen} title={_("Connect to a Wi-Fi network")}>
      <WifiNetworksList
        networks={networksFromValues(networks)}
        hiddenNetwork={baseHiddenNetwork}
        activeNetwork={activeNetwork}
        showHiddenForm={showHiddenForm}
        selectedNetwork={selectedNetwork}
        availableNetworks={networks}
        onSelectionCallback={(network) => {
          switchSelectedNetwork(network);
          if (network.settings && !network.connection) {
            client.network.connectTo(network.settings);
          }
        }}
        onCancelSelectionCallback={() => switchSelectedNetwork(activeNetwork)}
      />
      <Popup.Actions>
        <Popup.SecondaryAction onClick={onClose}>{_("Close")}</Popup.SecondaryAction>
      </Popup.Actions>
    </Popup>
  );
}

export default WifiSelector;
