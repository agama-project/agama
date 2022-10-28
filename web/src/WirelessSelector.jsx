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
import Popup from "./Popup";
import {
  Card,
  CardBody,
  Form,
  FormGroup,
  Radio,
  TextInput
} from "@patternfly/react-core";

import { useInstallerClient } from "./context/installer";
import { createConnection } from "./client/network/model";

function WirelessSelectorForm({ accessPoints, onClose, onSubmit }) {
  const [selected, setSelected] = useState(null);

  const networks = accessPoints.sort((a, b) => b.strength - a.strength);
  const ssids = networks.map(a => a.ssid);
  const filtered = networks.filter((ap, index) => {
    return (ap.ssid !== "" && ssids.indexOf(ap.ssid) <= index);
  });

  const isSelected = (network) => selected === network.ssid;

  const buildOptions = (networks) => {
    return networks.map(n => (
      <Card key={n.ssid}>
        <CardBody>
          <Radio
            id={n.ssid}
            label={n.ssid}
            description={`Strength: ${n.strength}%`}
            isChecked={isSelected(n)}
            onClick={() => setSelected(n.ssid)}
          />
        </CardBody>
      </Card>
    ));
  };

  const accept = (e) => {
    e.preventDefault();
    onSubmit(selected);
  };

  return (
    <Popup isOpen height="medium" title="Available networks">
      <Form id="select-network" onSubmit={accept}>
        <FormGroup isStack role="radiogroup">
          {buildOptions(filtered)}
        </FormGroup>
      </Form>

      <Popup.Actions>
        <Popup.Confirm form="select-network" type="submit">
          Connect
        </Popup.Confirm>
        <Popup.Cancel onClick={onClose} />
      </Popup.Actions>
    </Popup>
  );
}

function WirelessConnectionForm({ onClose, onSubmit }) {
  const [password, setPassword] = useState("");

  const accept = e => {
    e.preventDefault();

    onSubmit({ password });
    onClose();
  };

  return (
    <Popup isOpen height="medium" title="Connection details">
      <Form id="connect-network" onSubmit={accept}>
        <FormGroup fieldId="password" label="WPA Password">
          <TextInput
            id="password"
            name="password"
            aria-label="Password"
            value={password}
            label="Password"
            onChange={setPassword}
          />
        </FormGroup>
      </Form>
      <Popup.Actions>
        <Popup.Confirm form="connect-network" type="submit">
          Connect
        </Popup.Confirm>
        <Popup.Cancel onClick={onClose} />
      </Popup.Actions>
    </Popup>
  );
}

function WirelessSelector({ accessPoints, onClose }) {
  const [selectingNetwork, setSelectingNetwork] = useState(true);
  const [ssid, setSsid] = useState(null);
  const client = useInstallerClient();

  if (accessPoints.length === 0) return;

  const selectNetwork = (ssid) => {
    setSelectingNetwork(false);
    setSsid(ssid);
  };

  const connectNetwork = ({ password }) => {
    const wireless = { ssid, password };
    const connection = createConnection({
      name: ssid,
      wireless
    });
    client.network.addConnection(connection);
  };

  if (selectingNetwork) {
    return (
      <WirelessSelectorForm
        accessPoints={accessPoints} onSubmit={selectNetwork} onClose={onClose}
      />
    );
  } else {
    return (
      <WirelessConnectionForm onSubmit={connectNetwork} onClose={onClose} />
    );
  }
}

export default WirelessSelector;
