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

import { ConnectionState } from "./client/network/model";
import NetworkListItem from "./NetworkListItem";

function NetworksList({ networks, activeNetwork, selectedNetwork, onSelectionCallback, onCancelSelectionCallback }) {
  const isStateChanging = (network) => {
    const state = network.connection?.state;
    return state === ConnectionState.ACTIVATING || state === ConnectionState.DEACTIVATING;
  };

  return networks.map(n => {
    const isChecked = n.ssid === selectedNetwork?.ssid;
    const showAsChecked = !selectedNetwork && n.ssid === activeNetwork?.ssid;
    const showSpinner = (isChecked && n.settings && !n.connection) || isStateChanging(n);

    return (
      <NetworkListItem
        key={n.ssid}
        network={n}
        isChecked={isChecked}
        isFocused={isChecked && !n.settings}
        showAsChecked={showAsChecked}
        showSpinner={showSpinner}
        onSelect={() => {
          if (!isChecked) onSelectionCallback(n);
        }}
        onCancel={onCancelSelectionCallback}
      />
    );
  });
}

export default NetworksList;
