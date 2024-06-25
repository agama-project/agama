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
import { About, Page } from "~/components/core";
import { WifiNetworksListPage } from "~/components/network";
import { _ } from "~/i18n";
import { DeviceState } from "~/client/network/model";
import { Grid, GridItem, Timestamp } from "@patternfly/react-core";
import { useLoaderData } from "react-router-dom";

const networksFromValues = (networks) => Object.values(networks).flat();
const baseHiddenNetwork = { ssid: undefined, hidden: true };

// FIXME: use a reducer

function WifiSelectorPage() {
  const { network: client } = useInstallerClient();
  const { connections: initialConnections, devices: initialDevices, accessPoints, networks: initialNetworks } = useLoaderData();
  const [networks, setNetworks] = useState(initialNetworks);
  const [showHiddenForm, setShowHiddenForm] = useState(false);
  const [devices, setDevices] = useState(initialDevices);
  const [connections, setConnections] = useState(initialConnections);
  const [selectedNetwork, setSelectedNetwork] = useState(null);
  const [activeNetwork, setActiveNetwork] = useState(null);
  const [updateNetworks, setUpdateNetworks] = useState(false);
  const [needAuth, setNeedAuth] = useState(null);

  const switchSelectedNetwork = (network) => {
    setShowHiddenForm(network === baseHiddenNetwork);
    setSelectedNetwork(network);
  };

  useEffect(() => {
    setActiveNetwork(networksFromValues(networks).find(d => d.device));
  }, [networks]);

  useEffect(() => {
    async function fetchNetworks() {
      const devices = await client.devices();
      const connections = await client.connections();
      const networks = await client.loadNetworks(devices, connections, accessPoints);
      setDevices(devices);
      setConnections(connections);
      setNetworks(networks);
    }

    fetchNetworks();
    setUpdateNetworks(false);
  }, [updateNetworks, devices, connections, accessPoints, client]);

  useEffect(() => {
    return client.onNetworkChange(({ type, payload }) => {
      switch (type) {
        case NetworkEventTypes.DEVICE_ADDED: {
          setUpdateNetworks(true);
          break;
        }

        case NetworkEventTypes.DEVICE_UPDATED: {
          const [name, data] = payload;
          const current_device = devices.find((d) => d.name === name);

          if (data.state === DeviceState.FAILED) {
            if (current_device && (data.stateReason === 7)) {
              console.log(`FAILED Device ${name} updated' with data`, data);
              setNeedAuth(current_device.connection);
            }
          }

          setUpdateNetworks(true);
          break;
        }

        case NetworkEventTypes.DEVICE_REMOVED: {
          setUpdateNetworks(true);
          break;
        }
      }
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
