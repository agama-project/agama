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
import { Page } from "~/components/core";
import { WifiNetworksListPage } from "~/components/network";
import { _ } from "~/i18n";
import { DeviceState } from "~/client/network/model";
import { Grid, GridItem } from "@patternfly/react-core";
import { useLoaderData } from "react-router-dom";

const networksFromValues = (networks) => Object.values(networks).flat();
const baseHiddenNetwork = { ssid: undefined, hidden: true };

function WifiSelectorPage() {
  const { network: client } = useInstallerClient();
  const { connections: initialConnections, devices: initialDevices, accessPoints } = useLoaderData();
  const [networks, setNetworks] = useState([]);
  const [showHiddenForm, setShowHiddenForm] = useState(false);
  const [devices, setDevices] = useState(initialDevices);
  const [connections, setConnections] = useState(initialConnections);
  const [selectedNetwork, setSelectedNetwork] = useState(null);
  const [activeNetwork, setActiveNetwork] = useState(null);
  const [needAuth, setNeedAuth] = useState(null);

  const switchSelectedNetwork = (network) => {
    setShowHiddenForm(network === baseHiddenNetwork);
    setSelectedNetwork(network);
  };

  useEffect(() => {
    const loadNetworks = async () => {
      const knownSsids = [];
      console.log("Current devices es: ", devices);

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
            needAuth: needAuth === ap.ssid
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
  }, [client, connections, devices, accessPoints, needAuth]);

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
          const current_device = devices.find((d) => d.name === name);
          console.log("Data ", data);
          console.log("Name ", name);
          if (data.state === DeviceState.FAILED) {
            if (current_device && (data.stateReason === 7)) {
              // setNeedAuth(current_device.connection);
            }
          }
          setDevices(devs => {
            const newDevices = devs.filter((d) => d.name !== name);
            return [...newDevices, client.fromApiDevice(data)];
          });
          break;
        }

        case NetworkEventTypes.DEVICE_REMOVED: {
          console.log("REMOVED DEVICE");
          setDevices(devs => devs.filter((d) => d.name !== payload));
          break;
        }
      }
      client.connections().then(setConnections);
    });
  });

  return (
    <>
      <Page.Header>
        <h2>{_("Connect to a Wi-Fi network")}</h2>
      </Page.Header>
      <Page.MainContent>
        <Grid hasGutter>
          <GridItem sm={12}>
            <WifiNetworksListPage
              networks={networksFromValues(networks)}
              hiddenNetwork={baseHiddenNetwork}
              activeNetwork={activeNetwork}
              showHiddenForm={showHiddenForm}
              selectedNetwork={selectedNetwork}
              availableNetworks={networks}
              onSelectionCallback={(network) => {
                switchSelectedNetwork(network);
                if (network.settings && !network.device) {
                  client.connectTo(network.settings);
                }
              }}
              onCancelSelectionCallback={() => switchSelectedNetwork(activeNetwork)}
            />
          </GridItem>
        </Grid>
      </Page.MainContent>

      <Page.NextActions>
        <Page.CancelAction />
      </Page.NextActions>
    </>
  );
}

export default WifiSelectorPage;
