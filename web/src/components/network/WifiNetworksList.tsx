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

import React from "react";
import {
  Content,
  DataList,
  DataListCell,
  DataListItem,
  DataListItemCells,
  DataListItemRow,
  Flex,
  Label,
} from "@patternfly/react-core";
import { Icon } from "~/components/layout";
import { EmptyState } from "~/components/core";
import { DeviceState, WifiNetwork } from "~/types/network";
import { _ } from "~/i18n";
import { useNetworkChanges, useWifiNetworks } from "~/queries/network";
import { NETWORK as PATHS } from "~/routes/paths";
import { isEmpty, slugify } from "~/utils";
import { generatePath, useNavigate } from "react-router-dom";
import a11yStyles from "@patternfly/react-styles/css/utilities/Accessibility/accessibility";
import { IconProps } from "../layout/Icon";

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

const NetworkListName = ({ id, network }) => {
  const state = networkState(network.device?.state);

  return (
    <Flex id={id} columnGap={{ default: "columnGapXs" }}>
      <Content isEditorial>{network.ssid}</Content>
      {state === "Connected" && (
        <Label isCompact color="green">
          {state}
        </Label>
      )}
    </Flex>
  );
};

const NetworkSignal = ({ signal }) => {
  let label: string;
  let icon: IconProps["name"];

  if (signal > 70) {
    label = _("Excellent");
    icon = "network_wifi";
  } else if (signal > 30) {
    label = _("Good");
    icon = "network_wifi_3_bar";
  } else {
    label = _("Weak");
    icon = "network_wifi_1_bar";
  }

  return (
    <>
      <Icon name={icon} />
      <Content className={a11yStyles.screenReader}>
        {_("Signal strength")} {label}
      </Content>
    </>
  );
};

const NetworkSecurity = ({ security }) => {
  if (!isEmpty(security)) {
    return (
      <>
        <Icon name="lock" />
        <Content className={a11yStyles.screenReader}>{_("Secured")}</Content>
      </>
    );
  }

  return <Content className={a11yStyles.screenReader}>{_("Public")}</Content>;
};

const NetworkListItem = ({ network }) => {
  const headerId = slugify(`network-${network.ssid}`);
  return (
    <DataListItem id={network.ssid} aria-labelledby={headerId}>
      <DataListItemRow>
        <DataListItemCells
          dataListCells={[
            <DataListCell key="ssid" isFilled={false}>
              <NetworkListName id={headerId} network={network} />
            </DataListCell>,
            <DataListCell key="security" isFilled={false} alignRight>
              <Flex alignItems={{ default: "alignItemsCenter" }} gap={{ default: "gapSm" }}>
                <NetworkSecurity security={network.security} />
                <NetworkSignal signal={network.strength} />
              </Flex>
            </DataListCell>,
          ]}
        />
      </DataListItemRow>
    </DataListItem>
  );
};

/**
 * Component for displaying a list of available Wi-Fi networks
 */
function WifiNetworksList() {
  const navigate = useNavigate();
  useNetworkChanges();
  const networks: WifiNetwork[] = useWifiNetworks();
  // FIXME: improve below type casting, if possible

  if (networks.length === 0)
    return <EmptyState title={_("No visible Wi-Fi networks found")} icon="error" />;

  return (
    <>
      <DataList
        aria-label={_("Visible Wi-Fi networks")}
        onSelectDataListItem={(_, ssid) => navigate(generatePath(PATHS.wifiNetwork, { ssid }))}
      >
        {networks.map((n) => (
          <NetworkListItem key={n.ssid} network={n} />
        ))}
      </DataList>
    </>
  );
}

export default WifiNetworksList;
