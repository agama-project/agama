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
import { generatePath, useNavigate } from "react-router";
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
  Spinner,
} from "@patternfly/react-core";
import a11yStyles from "@patternfly/react-styles/css/utilities/Accessibility/accessibility";
import { Annotation, EmptyState } from "~/components/core";
import Icon, { IconProps } from "~/components/layout/Icon";
import { Connection, ConnectionState, WifiNetwork, WifiNetworkStatus } from "~/types/network";
import { useConnections, useNetworkChanges, useWifiNetworks } from "~/queries/network";
import { NETWORK as PATHS } from "~/routes/paths";
import { isEmpty } from "radashi";
import { formatIp } from "~/utils/network";
import { sprintf } from "sprintf-js";
import { _ } from "~/i18n";

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

type ConnectingSpinnerProps = { ssid: WifiNetwork["ssid"]; state: ConnectionState | undefined };
const ConnectingSpinner = ({ state, ssid }: ConnectingSpinnerProps) => {
  if (state !== ConnectionState.activating) return;

  // TRANSLATORS: %s will be replaced by Wi-Fi network SSID
  const label = sprintf(_("Connecting to %s"), ssid);

  return <Spinner size="sm" aria-label={label} />;
};

type NetworkListItemProps = {
  network: WifiNetwork;
  connection: Connection | undefined;
  showIp: boolean;
};

const NetworkListItem = ({ network, connection, showIp }: NetworkListItemProps) => {
  const nameId = useId();
  const securityId = useId();
  const statusId = useId();
  const signalId = useId();
  const ipId = useId();

  return (
    <DataListItem id={network.ssid}>
      <DataListItemRow>
        <DataListItemCells
          dataListCells={[
            <DataListCell key="ssid-status-and-ip">
              <Flex gap={{ default: "gapXs" }} direction={{ default: "column" }}>
                <Flex columnGap={{ default: "columnGapXs" }}>
                  <Content
                    id={nameId}
                    isEditorial
                    aria-labelledby={`${securityId} ${nameId} ${signalId}`}
                    aria-describedby={ipId}
                  >
                    {network.ssid}
                  </Content>
                  {connection?.state === ConnectionState.activated && (
                    <Label id={statusId} isCompact color="green">
                      {_("Connected")}
                    </Label>
                  )}
                </Flex>

                {showIp && network.device && (
                  <Content id={ipId} component="small">
                    <Content className={a11yStyles.screenReader}>{_("IP addresses")}</Content>
                    {network.device?.addresses.map(formatIp).join(", ")}
                  </Content>
                )}

                {connection && !connection.persistent && (
                  <Annotation>{_("Configured for installation only")}</Annotation>
                )}
              </Flex>
            </DataListCell>,
            <DataListCell key="badges" isFilled={false} alignRight>
              <Flex gap={{ default: "gapSm" }}>
                <ConnectingSpinner ssid={network.ssid} state={connection?.state} />
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
  const connections = useConnections();

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
        <NetworkListItem
          key={n.ssid}
          network={n}
          connection={connections.find((c) => c?.wireless?.ssid === n.ssid)}
          showIp={showIp}
        />
      ))}
    </DataList>
  );
}

export default WifiNetworksList;
