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
import {
  Button,
  Card,
  CardBody,
  Radio,
  Spinner,
  Split,
  SplitItem,
  Text
} from "@patternfly/react-core";

import {
  EOS_LOCK as LockIcon,
  EOS_SIGNAL_CELLULAR_ALT as SignalIcon
} from "eos-icons-react";

import Popup from "./Popup";
import Center from "./Center";
import WifiNetworkMenu from "./WifiNetworkMenu";
import WifiConnectionForm from "./WifiConnectionForm";
import { useInstallerClient } from "./context/installer";
import { ConnectionState } from "./client/network/model";
import { NetworkEventTypes } from "./client/network";

const networksFromValues = (networks) => Object.values(networks).flat();
const baseHiddenNetwork = { ssid: undefined, hidden: true };

const networkState = (state) => {
  switch (state) {
    case ConnectionState.ACTIVATING:
      return 'Connecting';
    case ConnectionState.ACTIVATED:
      return 'Connected';
    case ConnectionState.DEACTIVATING:
      return 'Disconnecting';
    case ConnectionState.DEACTIVATED:
      return 'Disconnected';
    default:
      return "";
  }
};

function WifiSelector({ isOpen = false, onClose }) {
  const client = useInstallerClient();
  const [networks, setNetworks] = useState([]);
  const [connections, setConnections] = useState([]);
  const [activeConnections, setActiveConnections] = useState(client.network.activeConnections());
  const [selectedNetwork, setSelectedNetwork] = useState(null);
  const [activeNetwork, setActiveNetwork] = useState(null);
  const [showHiddenForm, setShowHiddenForm] = useState(false);

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
            connection: activeConnections.find(c => c.name === ap.ssid)
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
  }, [client.network, connections, activeConnections]);

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

  const isStateChanging = (network) => {
    const state = network.connection?.state;
    return state === ConnectionState.ACTIVATING || state === ConnectionState.DEACTIVATING;
  };

  const renderFilteredNetworks = (networks) => {
    return networks.map(n => {
      const isChecked = n.ssid === selectedNetwork?.ssid;
      const showAsChecked = !selectedNetwork && n.ssid === activeNetwork?.ssid;
      const showSpinner = (isChecked && n.settings && !n.connection) || isStateChanging(n);

      let className = "selection-list-item";
      if (isChecked || showAsChecked) className += " selection-list-checked-item";
      if (isChecked && !n.settings) className += " selection-list-focused-item";

      return (
        <Card key={n.ssid} className={className}>
          <CardBody>
            <Split hasGutter className="header">
              <SplitItem isFilled>
                <Radio
                  id={n.ssid}
                  label={n.ssid}
                  description={
                    <>
                      <LockIcon size="10" color="grey" /> {n.security.join(", ")}{" "}
                      <SignalIcon size="10" color="grey" /> {n.strength}
                    </>
                  }
                  isChecked={isChecked || showAsChecked || false}
                  onClick={() => {
                    if (isChecked) return;
                    switchSelectedNetwork(n);
                    if (n.settings && !n.connection) client.network.connectTo(n.settings);
                  }}
                />
              </SplitItem>
              <SplitItem>
                <Center>
                  {showSpinner && <Spinner isSVG size="md" aria-label={`${n.ssid} connection is waiting for an state change`} /> }
                </Center>
              </SplitItem>
              <SplitItem>
                <Center>
                  <Text component="small" className="keep-words">
                    { showSpinner && !n.connection && "Connecting" }
                    { networkState(n.connection?.state)}
                  </Text>
                </Center>
              </SplitItem>
              { n.settings &&
                <SplitItem>
                  <Center>
                    <WifiNetworkMenu settings={n.settings} />
                  </Center>
                </SplitItem> }
            </Split>
            { isChecked && (!n.settings || n.settings.error) &&
              <Split hasGutter>
                <SplitItem isFilled className="content">
                  <WifiConnectionForm network={n} onCancel={() => switchSelectedNetwork(activeNetwork)} />
                </SplitItem>
              </Split> }
          </CardBody>
        </Card>
      );
    });
  };

  const renderHiddenNetworkForm = () => {
    return (
      <>
        <Card className={showHiddenForm ? "selection-list-item selection-list-focused-item" : "selection-list-item collapsed"}>
          <CardBody>
            <Split hasGutter className="content">
              <SplitItem isFilled>
                { showHiddenForm &&
                  <WifiConnectionForm
                    network={selectedNetwork}
                    onCancel={() => switchSelectedNetwork(activeNetwork)}
                    onSubmitCallback={switchSelectedNetwork}
                  /> }
              </SplitItem>
            </Split>
          </CardBody>
        </Card>
        { !showHiddenForm &&
          <Center>
            <Button
              variant="link"
              onClick={() => switchSelectedNetwork(baseHiddenNetwork)}
            >
              Connect to hidden network
            </Button>
          </Center> }
      </>
    );
  };

  return (
    <Popup isOpen={isOpen} height="large" title="Connect to a Wi-Fi network">
      { renderFilteredNetworks(networksFromValues(networks)) }
      { renderHiddenNetworkForm() }

      <Popup.Actions>
        <Popup.SecondaryAction onClick={onClose}>Close</Popup.SecondaryAction>
      </Popup.Actions>
    </Popup>
  );
}

export default WifiSelector;
