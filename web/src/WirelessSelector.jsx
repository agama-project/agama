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
  Card,
  CardBody,
  Form,
  FormGroup,
  FormSelect,
  FormSelectOption,
  Radio,
  TextInput
} from "@patternfly/react-core";

import { useInstallerClient } from "./context/installer";

const CONNECTION_FORM_ID = "chosen-network";

function WirelessConnectionForm({ network, setSubmittingData, onClose }) {
  const client = useInstallerClient();
  const [error, setError] = useState(false);
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
    await client.network.connectTo(network.ssid, { security, password });
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

function WirelessSelector({ accessPoints, onClose }) {
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

  const renderFilteredNetworks = () => {
    return filtered.map(n => {
      const selected = isSelected(n);
      const description = `Security: ${n.security.join(',')}, Strength: ${n.strength}%`;

      let className = "available-network";
      if (selected) className += " selected-network";

      return (
        <Card key={n.ssid} className={className}>
          <CardBody>
            <div className="header">
              <Radio
                id={n.ssid}
                label={n.ssid}
                description={description}
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

  const height = filtered.length < 5 ? "medium" : "large";

  return (
    <Popup isOpen height={height} title="Available networks">
      {renderFilteredNetworks()}

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
