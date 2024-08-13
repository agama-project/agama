/*
 * Copyright (c) [2024] SUSE LLC
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
  Button,
  Card,
  CardBody,
  DataList,
  DataListCell,
  DataListItem,
  DataListItemCells,
  DataListItemRow,
  Drawer,
  DrawerActions,
  DrawerCloseButton,
  DrawerContent,
  DrawerContentBody,
  DrawerHead,
  DrawerPanelBody,
  DrawerPanelContent,
  Flex,
  Label,
  Spinner,
  Split,
  Stack,
} from "@patternfly/react-core";
import { generatePath } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { Icon } from "~/components/layout";
import { WifiConnectionForm } from "~/components/network";
import { Link } from "~/components/core";
import { DeviceState } from "~/client/network/model";
import { formatIp } from "~/client/network/utils";
import { useInstallerClient } from "~/context/installer";
import { useSelectedWifi, useSelectedWifiChange } from "~/queries/network";
import { PATHS } from "~/routes/network";
import { _ } from "~/i18n";

const HIDDEN_NETWORK = Object.freeze({ hidden: true });

// FIXME: Move to the model and stop using translations for checking the state
const networkState = (state) => {
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

const connectionAddresses = (network) => {
  const { device, settings } = network;
  const addresses = device ? device.addresses : settings?.addresses;

  return addresses?.map(formatIp).join(", ");
};

const ConnectionData = ({ network }) => {
  return <Stack hasGutter>{connectionAddresses(network)}</Stack>;
};

const WifiDrawerPanelBody = ({ network, onCancel }) => {
  const client = useInstallerClient();
  const queryClient = useQueryClient();
  const { data } = useSelectedWifi();
  const forgetNetwork = async () => {
    await client.network.deleteConnection(network.settings.id);
    queryClient.invalidateQueries({ queryKey: ["network", "connections"] });
  };

  if (!network) return;

  const Form = () => <WifiConnectionForm network={network} onCancel={onCancel} />;

  if (network === HIDDEN_NETWORK) return <Form />;

  if (data.needsAuth) return <Form />;

  if (network.settings && !network.device) {
    return (
      <Split hasGutter>
        <Link onClick={async () => await client.network.connectTo(network.settings)}>
          {_("Connect")}
        </Link>
        <Link to={generatePath(PATHS.editConnection, { id: network.settings.id })}>
          {_("Edit")}
        </Link>
        <Button variant="secondary" isDanger onClick={forgetNetwork}>
          {_("Forget")}
        </Button>
      </Split>
    );
  }

  // FIXME: stop using translations
  switch (networkState(network.device?.state)) {
    case _("Connecting"):
      return <Spinner />;
    case _("Disconnected"):
      return !network?.settings && <Form />;
    case _("Connected"):
      return (
        <Stack>
          <ConnectionData network={network} />
          <Split hasGutter>
            <Link onClick={async () => await client.network.disconnect(network.settings)}>
              {_("Disconnect")}
            </Link>
            <Link to={generatePath(PATHS.editConnection, { id: network.settings.id })}>
              {_("Edit")}
            </Link>
            <Button
              variant="secondary"
              isDanger
              onClick={async () => await client.network.deleteConnection(network.settings.id)}
            >
              {_("Forget")}
            </Button>
          </Split>
        </Stack>
      );
    default:
      return <Form />;
  }
};

const NetworkFormName = ({ network }) => {
  if (!network) return;

  return <h3>{network === HIDDEN_NETWORK ? _("Connect to a hidden network") : network.ssid}</h3>;
};

const NetworkListName = ({ network }) => {
  const state = networkState(network.device?.state);

  return (
    <Flex columnGap={{ default: "columnGapXs" }}>
      <b>{network.ssid}</b>
      {network.settings && (
        <Label isCompact color="cyan" variant="outline">
          {_("configured")}
        </Label>
      )}
      {state === _("Connected") && (
        <Label isCompact color="green">
          {state}
        </Label>
      )}
    </Flex>
  );
};

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
function WifiNetworksListPage({ networks = [] }) {
  const { data } = useSelectedWifi();
  const selected =
    data.ssid === undefined ? HIDDEN_NETWORK : networks.find((n) => n.ssid === data.ssid);
  const changeSelected = useSelectedWifiChange();

  const selectHiddneNetwork = () => {
    changeSelected.mutate({ ssid: undefined, needsAuth: null });
  };

  const selectNetwork = (ssid) => {
    changeSelected.mutate({ ssid, needsAuth: null });
  };

  const unselectNetwork = () => {
    changeSelected.mutate({ ssid: null, needsAuth: null });
  };

  const renderElements = () => {
    return networks.map((n) => {
      return (
        <DataListItem id={n.ssid} key={n.ssid}>
          <DataListItemRow>
            <DataListItemCells
              dataListCells={[
                <DataListCell key="ssid">
                  <Flex direction={{ default: "column" }} rowGap={{ default: "rowGapSm" }}>
                    <NetworkListName network={n} />
                    <Flex
                      alignItems={{ default: "alignItemsCenter" }}
                      columnGap={{ default: "columnGapSm" }}
                    >
                      <div>
                        <Icon name="lock" size="10" fill="grey" /> {n.security.join(", ")}
                      </div>
                      <div>
                        <Icon name="signal_cellular_alt" size="10" fill="grey" /> {n.strength}
                      </div>
                    </Flex>
                  </Flex>
                </DataListCell>,
              ]}
            />
          </DataListItemRow>
        </DataListItem>
      );
    });
  };

  return (
    <Card isRounded isCompact>
      <CardBody>
        <Drawer isExpanded={selected}>
          <DrawerContent
            panelContent={
              <DrawerPanelContent>
                <DrawerHead>
                  <NetworkFormName network={selected} />
                  <DrawerActions>
                    <DrawerCloseButton onClick={unselectNetwork} />
                  </DrawerActions>
                </DrawerHead>
                <DrawerPanelBody>
                  <WifiDrawerPanelBody network={selected} onCancel={unselectNetwork} />
                </DrawerPanelBody>
              </DrawerPanelContent>
            }
          >
            <DrawerContentBody>
              <Stack hasGutter>
                <DataList
                  isCompact
                  selectedDataListItemId={selected?.ssid}
                  onSelectDataListItem={(_, ssid) => selectNetwork(ssid)}
                >
                  {renderElements()}
                </DataList>
                <Button variant="link" onClick={selectHiddneNetwork}>
                  {_("Connect to hidden network")}
                </Button>
              </Stack>
            </DrawerContentBody>
          </DrawerContent>
        </Drawer>
      </CardBody>
    </Card>
  );
}

export default WifiNetworksListPage;
