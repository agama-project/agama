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
  Alert,
  Button,
  Card,
  CardActions,
  CardBody,
  CardHeader,
  CardTitle,
  DropDown,
  DropDownItem,
  Form,
  FormGroup,
  FormSelect,
  FormSelectOption,
  Radio,
  TextInput
} from "@patternfly/react-core";

import {
  EOS_LOCK as LockIcon,
  EOS_SIGNAL_CELLULAR_ALT as SignalIcon
} from "eos-icons-react";

import Center from "./Center";

import { useInstallerClient } from "./context/installer";

const CONNECTION_FORM_ID = "chosen-network";
const baseHiddenNetwork = { ssid: "", hidden: true };

function WirelessConnectionForm({ network, setSubmittingData, onClose }) {
  const client = useInstallerClient();
  const [error, setError] = useState(false);
  const [ssid, setSsid] = useState(network.ssid);
  const [password, setPassword] = useState("");
  const [security, setSecurity] = useState("none");

  const security_options = [
    { value: "", label: "None" },
    { value: "wpa-psk", label: "WPA & WPA2 Personal" },
    { value: "wpa-eap", label: "WPA & WPA2 Enterprise" }
  ];

  const selectorOptions = security_options.map(security => (
    <FormSelectOption key={security.value} value={security.value} label={security.label} />
  ));

  const connectNetwork = async () => {
    await client.network.connectTo(ssid, { security, password });
  };

  const accept = async e => {
    e.preventDefault();
    setError(false);
    setSubmittingData(true);

    connectNetwork()
      .then(() => onClose())
      .catch(() => {
        setError(true);
        setSubmittingData(false);
      });
  };

  return (
    <Form id={CONNECTION_FORM_ID} onSubmit={accept}>
      { error &&
        <Alert variant="warning" isInline title="Something went wrong">
          <p>Please, review provided settings and try again.</p>
        </Alert> }

      { network.hidden &&
        <FormGroup fieldId="ssid" label="SSID">
          <TextInput
            id="ssid"
            name="ssid"
            label="SSID"
            aria-label="ssid"
            value={ssid}
            onChange={setSsid}
          />
        </FormGroup> }

      <FormGroup fieldId="security" label="Security">
        <FormSelect
          id="security"
          aria-label="security"
          value={security}
          onChange={setSecurity}
        >
          {selectorOptions}
        </FormSelect>
      </FormGroup>
      { security === "wpa-psk" &&
        <FormGroup fieldId="password" label="WPA Password">
          <TextInput
            id="password"
            name="password"
            aria-label="Password"
            value={password}
            label="Password"
            onChange={setPassword}
          />
        </FormGroup> }
    </Form>
  );
}

function WirelessSelector({ activeConnections, connections, accessPoints, onClose }) {
  const client = useInstallerClient();
  const [selected, setSelected] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [actionsDisabled, setActionsDisabled] = useState(false);

  const networks = accessPoints.sort((a, b) => b.strength - a.strength);
  const ssids = networks.map(a => a.ssid);
  const filtered = networks.filter((ap, index) => {
    return (ap.ssid !== "" && ssids.indexOf(ap.ssid) >= index);
  });

  const setSubmittingData = (value) => {
    setIsLoading(value);
    setActionsDisabled(value);
  };

  const isSelected = (network) => selected === network.ssid;
  const isConnected = (network) => activeConnections.find((n) => n.name === network.ssid);
  const isConfigured = (network) => connections.find((n) => n.wireless?.ssid === network.ssid);

  const deleteConnection = (ssid) => {
    const conn = connections.find((n) => n.name === ssid);

    client.network.deleteConnection(conn);
  };


  const renderFilteredNetworks = () => {
    return filtered.map(n => {
      const selected = isSelected(n);
      const configured = isConfigured(n);
      const connected = isConnected(n);

      let className = "available-network";
      let label = n.ssid;
      if (selected) className += " selected-network";
      if (connected) label += " (Connected)";

      return (
        <Card key={n.ssid} className={className}>
          <CardBody>
            <div className="header">
              <Radio
                id={n.ssid}
                label={label}
                description={
                  <>
                    <LockIcon size="10" color="grey" /> {n.security.join(", ")}{" "}
                    <SignalIcon size="10" color="grey" /> {n.strength}
                    { configured && <Button variant="button" onClick={() => deleteConnection(n.ssid)}>Forget Connection</Button>}
                  </>
                }
                isChecked={selected}
                onClick={() => setSelected(n.ssid)}
              />
            </div>
            { selected &&
              <div className="content">
                <WirelessConnectionForm
                  network={n}
                  setSubmittingData={setSubmittingData}
                  onClose={onClose}
                />
              </div> }
          </CardBody>
        </Card>
      );
    });
  };

  const renderHiddenNetworkForm = () => {
    return (
      <Card>
        <CardBody>
          <WirelessConnectionForm
            network={selected}
            setSubmittingData={setSubmittingData}
            onClose={onClose}
          />
        </CardBody>
      </Card>
    );
  };

  const renderSwitchFormLink = () => {
    if (selected?.hidden) {
      return (
        <Center>
          <Button variant="link" onClick={() => setSelected(null)}>Choose a visible network instead</Button>
        </Center>
      );
    }

    return (
      <Center>
        <Button variant="link" onClick={() => setSelected(baseHiddenNetwork)}>Connect to a hidden network</Button>
      </Center>
    );
  };

  const height = filtered.length < 5 ? "medium" : "large";

  return (
    <Popup isOpen height={height} title="Connect to Wi-Fi network">
      { renderFilteredNetworks() }
      { renderSwitchFormLink() }
      {selected?.hidden && renderHiddenNetworkForm()}

      <Popup.Actions>
        <Popup.Confirm
          type="submit"
          form={CONNECTION_FORM_ID}
          isDisabled={actionsDisabled || !selected}
          isLoading={isLoading}
        >
          { isLoading ? "Connecting" : "Connect" }
        </Popup.Confirm>
        <Popup.Cancel onClick={onClose} isDisabled={actionsDisabled} />
      </Popup.Actions>
    </Popup>
  );
}

export default WirelessSelector;
