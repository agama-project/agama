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
  Radio,
  Spinner,
  Text
} from "@patternfly/react-core";

import { ConnectionState } from "~/client/network/model";

import { Icon } from "~/components/layout";
import { WifiNetworkMenu, WifiConnectionForm } from "~/components/network";

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
 * Component for displaying a Wi-Fi network within a NetworkList
 *
 * @param {object} props - component props
 * @param {object} props.networks - the ap/configured network to be displayed
 * @param {boolean} [props.isSelected] - whether the network has been selected by the user
 * @param {boolean} [props.isActive] - whether the network is currently active
 * @param {function} props.onSelect - function to execute when the network is selected
 * @param {function} props.onCancel - function to execute when the selection is cancelled
 */
function WifiNetworkListItem ({ network, isSelected, isActive, onSelect, onCancel }) {
  // Do not wait until receive the next D-Bus network event to have the connection object available
  // and display the spinner as soon as possible. I.e., renders it immediately when the user clicks
  // on an already configured network.
  const showSpinner = (isSelected && network.settings && !network.connection) || isStateChanging(network);

  return (
    <li
      key={network.ssid}
      data-state={(isSelected && !network.settings && "focused") || null}
    >
      <div className="header split justify-between">
        <Radio
          id={network.ssid}
          label={network.ssid}
          description={
            <>
              <Icon name="lock" size="10" fill="grey" /> {network.security.join(", ")}{" "}
              <Icon name="signal_cellular_alt" size="10" fill="grey" /> {network.strength}
            </>
          }
          isChecked={isSelected || isActive || false}
          onClick={onSelect}
        />
        <div className="split">
          {showSpinner && <Spinner isSVG size="md" aria-label={`${network.ssid} connection is waiting for an state change`} /> }
          <Text component="small" className="keep-words">
            { showSpinner && !network.connection && "Connecting" }
            { networkState(network.connection?.state)}
          </Text>
          { network.settings &&
            <WifiNetworkMenu settings={network.settings} /> }
        </div>
      </div>
      { isSelected && (!network.settings || network.settings.error) &&
        <div className="content">
          <WifiConnectionForm network={network} onCancel={onCancel} />
        </div>}
    </li>
  );
}

export default WifiNetworkListItem;
