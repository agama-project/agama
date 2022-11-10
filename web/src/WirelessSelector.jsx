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
import {
  Button,
  Card,
  CardBody,
  Radio,
  Split,
  SplitItem,
} from "@patternfly/react-core";

import {
  EOS_LOCK as LockIcon,
  EOS_SIGNAL_CELLULAR_ALT as SignalIcon
} from "eos-icons-react";

import Popup from "./Popup";
import Center from "./Center";
import WifiNetworkMenu from "./WifiNetworkMenu";
import WifiConnectionForm from "./WifiConnectionForm";

const baseHiddenNetwork = { ssid: "", hidden: true };

function WirelessSelector({ activeConnections, connections, accessPoints, onClose }) {
  const [selected, setSelected] = useState(null);
  const unsetSelected = () => setSelected(null);

  const networks = accessPoints.sort((a, b) => b.strength - a.strength);
  const ssids = networks.map(a => a.ssid);
  const filtered = networks.filter((ap, index) => {
    return (ap.ssid !== "" && ssids.indexOf(ap.ssid) >= index);
  });

  const isSelected = (network) => selected === network.ssid;
  const isConnected = (network) => activeConnections.find((n) => n.name === network.ssid);

  const renderFilteredNetworks = () => {
    return filtered.map(n => {
      const settings = connections.find((conn) => conn.wireless?.ssid === n.ssid);
      const selected = isSelected(n);
      const configured = !!settings;
      const connected = isConnected(n);

      let className = "available-network";
      let label = n.ssid;
      if (selected) className += " selected-network";
      if (connected) label += " (Connected)";

      return (
        <Card key={n.ssid} className={className}>
          <CardBody>
            <Split hasGutter className="header">
              <SplitItem isFilled>
                <Radio
                  id={n.ssid}
                  label={label}
                  description={
                    <>
                      <LockIcon size="10" color="grey" /> {n.security.join(", ")}{" "}
                      <SignalIcon size="10" color="grey" /> {n.strength}
                    </>
                  }
                  isChecked={selected}
                  onClick={() => setSelected(n.ssid)}
                />
              </SplitItem>
              { configured &&
                <SplitItem>
                  <Center>
                    <WifiNetworkMenu settings={settings} />
                  </Center>
                </SplitItem> }
            </Split>
            { selected &&
              <Split hasGutter>
                <SplitItem isFilled className="content">
                  <WifiConnectionForm network={n} onCancel={unsetSelected} />
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
        <Card className={selected?.hidden ? "available-network selected-network" : "available-network collapsed"}>
          <CardBody>
            <Split hasGutter className="content">
              <SplitItem isFilled>
                <WifiConnectionForm network={selected} onCancel={unsetSelected} />
              </SplitItem>
            </Split>
          </CardBody>
        </Card>
        { !selected?.hidden &&
          <Center>
            <Button
              variant="link"
              onClick={() => setSelected(baseHiddenNetwork)}
            >
              Add network manually
            </Button>
          </Center> }
      </>
    );
  };

  return (
    <Popup isOpen height="large" title="Connect to Wi-Fi network">
      { renderFilteredNetworks() }
      { renderHiddenNetworkForm() }

      <Popup.Actions>
        <Popup.PrimaryAction onClick={onClose}>Close</Popup.PrimaryAction>
      </Popup.Actions>
    </Popup>
  );
}

export default WirelessSelector;
