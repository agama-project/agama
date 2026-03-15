/*
 * Copyright (c) [2026] SUSE LLC
 *
 * All Rights Reserved.
 *
 * This program is free software; you can redistribute it and/or modify it
 * under the terms of the GNU General Public License as published by the Free
 * Software Foundation; either version 2 of the License, or (at your option)
 * any later version.
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
import { FormSelect, FormSelectOption, FormSelectProps } from "@patternfly/react-core";
import { WifiNetwork, WifiNetworkStatus } from "~/types/network";
import { useNetworkChanges, useWifiNetworks } from "~/hooks/model/system/network";

type WifiNetworksSelectorProps = Omit<FormSelectProps, "children" | "ref">;

/**
 * Component for displaying a list of available Wi-Fi networks
 */
export default function WifiNetworksSelector({
  value,
  ...formSelectorProps
}: WifiNetworksSelectorProps) {
  useNetworkChanges();
  const networks: WifiNetwork[] = useWifiNetworks();

  const statusOrder = [
    WifiNetworkStatus.CONNECTED,
    WifiNetworkStatus.CONFIGURED,
    WifiNetworkStatus.NOT_CONFIGURED,
  ];

  // Sort networks by status and signal
  networks.sort(
    (a, b) =>
      statusOrder.indexOf(a.status) - statusOrder.indexOf(b.status) || b.strength - a.strength,
  );

  return (
    <FormSelect id="ssid" value={value} {...formSelectorProps}>
      {networks.map((network, index) => (
        <FormSelectOption key={index} label={network.ssid} value={network.ssid} />
      ))}
    </FormSelect>
  );
}
