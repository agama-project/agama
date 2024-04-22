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
  const { network: client } = useInstallerClient();
  const [networks, setNetworks] = useState([]);
  const [showHiddenForm, setShowHiddenForm] = useState(false);
  const [devices, setDevices] = useState([]);
  const [connections, setConnections] = useState([]);
  const [accessPoints, setAccessPoints] = useState([]);
  const [selectedNetwork, setSelectedNetwork] = useState(null);
  const [activeNetwork, setActiveNetwork] = useState(null);

  const switchSelectedNetwork = (network) => {
    setShowHiddenForm(network === baseHiddenNetwork);
    setSelectedNetwork(network);
  };

  useEffect(() => {
    client.devices().then(setDevices);
    client.connections().then(setConnections);
    client.accessPoints().then(setAccessPoints);
  }, [client]);

  useEffect(() => {
    const loadNetworks = async () => {
      const knownSsids = [];

      return accessPoints
        .sort((a, b) => b.strength - a.strength)
        .reduce((networks, ap) => {
          // Do not include networks without SSID
          if (!ap.ssid || ap.ssid === "") return networks;
          // Do not include "duplicates"
          if (knownSsids.includes(ap.ssid)) return networks;

          const network = {
            ...ap,
            settings: connections.find(c => c.wireless?.ssid === ap.ssid),
            device: devices.find(c => c.connection === ap.ssid),
            error: undefined
          };

          // Group networks
          if (network.device) {
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
      setActiveNetwork(networksFromValues(data).find(d => d.device));
    });
  }, [client, connections, devices, accessPoints, isOpen]);

  useEffect(() => {
    return client.onNetworkChange(({ type, payload }) => {
      switch (type) {
        case NetworkEventTypes.DEVICE_ADDED: {
          setDevices((devs) => {
            const newDevices = devs.filter((d) => d.name !== payload.name);
            return [...newDevices, client.fromApiDevice(payload)];
          });
          break;
        }

        case NetworkEventTypes.DEVICE_UPDATED: {
          const [name, data] = payload;
          if (data.state === "failed") {
            selectedNetwork.error = "Failed";
          }
          setDevices(devs => {
            const newDevices = devs.filter((d) => d.name !== name);
            return [...newDevices, client.fromApiDevice(data)];
          });
          break;
        }

        case NetworkEventTypes.DEVICE_REMOVED: {
          setDevices(devs => devs.filter((d) => d.name !== payload));
          break;
        }
      }
      client.connections().then(setConnections);
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
          if (network.settings && !network.device) {
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
