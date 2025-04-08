/*
 * Copyright (c) [2024-2025] SUSE LLC
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

import React, { useId } from "react";
import { generatePath, useNavigate } from "react-router-dom";
import {
  Content,
  DataList,
  DataListCell,
  DataListItem,
  DataListItemCells,
  DataListItemRow,
  DataListProps,
  Flex,
  Label,
} from "@patternfly/react-core";
import a11yStyles from "@patternfly/react-styles/css/utilities/Accessibility/accessibility";
import { EmptyState } from "~/components/core";
import Icon, { IconProps } from "~/components/layout/Icon";
import { DeviceState, WifiNetwork, WifiNetworkStatus } from "~/types/network";
import { useNetworkChanges, useWifiNetworks } from "~/queries/network";
import { NETWORK as PATHS } from "~/routes/paths";
import { isEmpty } from "~/utils";
import { formatIp } from "~/utils/network";
import { _ } from "~/i18n";

// FIXME: Move to the model and stop using translations for checking the state
const networkState = (state: DeviceState): string => {
  switch (state) {
    case DeviceState.CONFIG:
    case DeviceState.IPCHECK:
      // TRANSLATORS: Wifi network status
      return _("Connecting");
    case DeviceState.ACTIVATED:
      // TRANSLATORS: Wifi network status
      return _("Connected");
    case DeviceState.DEACTIVATING:
    case DeviceState.FAILED:
    case DeviceState.DISCONNECTED:
      // TRANSLATORS: Wifi network status
      return _("Disconnected");
    default:
      return "";
  }
};

const NetworkSignal = ({ id, signal }) => {
  let label: string;
  let icon: IconProps["name"];

  if (signal > 70) {
    label = _("Excellent signal");
    icon = "network_wifi";
  } else if (signal > 30) {
    label = _("Good signal");
    icon = "network_wifi_3_bar";
  } else {
    label = _("Weak signal");
    icon = "network_wifi_1_bar";
  }

  return (
    <>
      <Icon name={icon} />
      <Content id={id} className={a11yStyles.screenReader}>
        {label}
      </Content>
    </>
  );
};

const NetworkSecurity = ({ id, security }) => {
  if (!isEmpty(security)) {
    return (
      <>
        <Icon name="lock" />
        <Content id={id} className={a11yStyles.screenReader}>
          {_("Secured network")}
        </Content>
      </>
    );
  }

  return (
    <Content id={id} className={a11yStyles.screenReader}>
      {_("Public network")}
    </Content>
  );
};

type NetworkListItemProps = { network: WifiNetwork; showIp: boolean };

const NetworkListItem = ({ network, showIp }: NetworkListItemProps) => {
  const nameId = useId();
  const securityId = useId();
  const statusId = useId();
  const signalId = useId();
  const ipId = useId();

  const state = networkState(network.device?.state);

  return (
    <DataListItem
      id={network.ssid}
      aria-labelledby={`${securityId} ${nameId} ${signalId}`}
      aria-describedby={ipId}
    >
      <DataListItemRow>
        <DataListItemCells
          dataListCells={[
            <DataListCell key="ssid-status-and-ip">
              <Flex gap={{ default: "gapXs" }} direction={{ default: "column" }}>
                <Flex columnGap={{ default: "columnGapXs" }}>
                  <Content id={nameId} isEditorial>
                    {network.ssid}
                  </Content>
                  {state === "Connected" && (
                    <Label id={statusId} isCompact color="green">
                      {state}
                    </Label>
                  )}
                </Flex>

                {showIp && network.device && (
                  <Content id={ipId} component="small">
                    <Content className={a11yStyles.screenReader}>{_("IP addresses")}</Content>
                    {network.device?.addresses.map(formatIp).join(", ")}
                  </Content>
                )}
              </Flex>
            </DataListCell>,
            <DataListCell key="security-and-signal" isFilled={false} alignRight>
              <Flex gap={{ default: "gapSm" }}>
                <NetworkSecurity security={network.security} id={securityId} />
                <NetworkSignal signal={network.strength} id={signalId} />
              </Flex>
            </DataListCell>,
          ]}
        />
      </DataListItemRow>
    </DataListItem>
  );
};

type WifiNetworksListProps = DataListProps & { showIp?: boolean };

/**
 * Component for displaying a list of available Wi-Fi networks
 */
function WifiNetworksList({ showIp = true, ...props }: WifiNetworksListProps) {
  useNetworkChanges();
  const navigate = useNavigate();
  const networks: WifiNetwork[] = useWifiNetworks();

  if (networks.length === 0)
    return <EmptyState title={_("No Wi-Fi networks were found")} icon="error" />;

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
    <DataList
      onSelectDataListItem={(_, ssid) => navigate(generatePath(PATHS.wifiNetwork, { ssid }))}
      {...props}
    >
      {networks.map((n) => (
        <NetworkListItem key={n.ssid} network={n} showIp={showIp} />
      ))}
    </DataList>
  );
}

export default WifiNetworksList;
