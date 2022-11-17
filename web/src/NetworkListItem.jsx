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

import React from "react";

import {
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

import { ConnectionState } from "./client/network/model";

import Center from "./Center";
import WifiNetworkMenu from "./WifiNetworkMenu";
import WifiConnectionForm from "./WifiConnectionForm";

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

const isStateChanging = (network) => {
  const state = network.connection?.state;
  return state === ConnectionState.ACTIVATING || state === ConnectionState.DEACTIVATING;
};

/**
 * Component for displaying a Wi-Fi network within a NetowrkList
 *
 * @param {object} props - component props
 * @param {object} props.networks - the ap/configured network to be displayed
 * @param {boolean} [props.isSelected] - whether the network has been selected by the user
 * @param {boolean} [props.isActive] - whether the network is currently active
 * @param {function} props.onSelect - function to execute when the network is selected
 * @param {function} props.onCancel - function to execute when the selection is cancelled
 */
function NetworkListItem ({ network, isSelected, isActive, onSelect, onCancel }) {
  // Do not wait until receive the next D-Bus network event to have the connection object available
  // and display the spinner as soon as possible. I.e., renders it inmmediately when the user clicks
  // on an already configured network.
  const showSpinner = (isSelected && network.settings && !network.connection) || isStateChanging(network);

  return (
    <Card
      key={network.ssid}
      className={[
        "selection-list-item",
        (isSelected || isActive) && "selection-list-checked-item",
        isSelected && !network.settings && "selection-list-focused-item"
      ].join(" ")}
    >
      <CardBody>
        <Split hasGutter className="header">
          <SplitItem isFilled>
            <Radio
              id={network.ssid}
              label={network.ssid}
              description={
                <>
                  <LockIcon size="10" color="grey" /> {network.security.join(", ")}{" "}
                  <SignalIcon size="10" color="grey" /> {network.strength}
                </>
              }
              isChecked={isSelected || isActive || false}
              onClick={onSelect}
            />
          </SplitItem>
          <SplitItem>
            <Center>
              {showSpinner && <Spinner isSVG size="md" aria-label={`${network.ssid} connection is waiting for an state change`} /> }
            </Center>
          </SplitItem>
          <SplitItem>
            <Center>
              <Text component="small" className="keep-words">
                { showSpinner && !network.connection && "Connecting" }
                { networkState(network.connection?.state)}
              </Text>
            </Center>
          </SplitItem>
          { network.settings &&
            <SplitItem>
              <Center>
                <WifiNetworkMenu settings={network.settings} />
              </Center>
            </SplitItem> }
        </Split>
        { isSelected && (!network.settings || network.settings.error) &&
          <Split hasGutter>
            <SplitItem isFilled className="content">
              <WifiConnectionForm network={network} onCancel={onCancel} />
            </SplitItem>
          </Split> }
      </CardBody>
    </Card>
  );
}

export default NetworkListItem;
