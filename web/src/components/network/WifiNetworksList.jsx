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

import { WifiNetworkListItem, WifiHiddenNetworkForm } from "~/components/network";

/**
 * Component for displaying a list of available Wi-Fi networks
 *
 * @param {object} props - component props
 * @param {object[]} [props.networks=[]] - list of networks to show
 * @param {object} [props.activeNetwork] - the active network
 * @param {object} [props.selectedNetwork] - the selected network (not necessarily the same as active)
 * @param {function} props.onSelectionCallback - the function to trigger when user selects a network
 * @param {function} props.onCancelCallback - the function to trigger when user cancel dismiss before connecting to a network
 */
function WifiNetworksList({
  networks = [],
  hiddenNetwork,
  activeNetwork,
  selectedNetwork,
  onSelectionCallback,
  onCancelSelectionCallback,
  showHiddenForm
}) {
  const renderElements = () => {
    return networks.map(n => {
      const isSelected = n.ssid === selectedNetwork?.ssid;
      const isActive = !selectedNetwork && n.ssid === activeNetwork?.ssid;

      return (
        <WifiNetworkListItem
          key={n.ssid}
          network={n}
          isSelected={isSelected}
          isActive={isActive}
          onSelect={() => {
            if (!isSelected) onSelectionCallback(n);
          }}
          onCancel={onCancelSelectionCallback}
        />
      );
    });
  };

  return (
    <ul className="selection-list" data-type="agama/list">
      {renderElements()}
      <li data-state={showHiddenForm ? "focused" : "unstyled"}>
        <div className="content">
          <WifiHiddenNetworkForm
            network={hiddenNetwork}
            visible={showHiddenForm}
            beforeDisplaying={() => onSelectionCallback(hiddenNetwork)}
            beforeHiding={() => onSelectionCallback(activeNetwork)}
            onSubmitCallback={onSelectionCallback}
          />
        </div>
      </li>
    </ul>
  );
}

export default WifiNetworksList;
