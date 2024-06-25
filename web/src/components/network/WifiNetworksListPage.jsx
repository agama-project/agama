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
import {
  Card,
  CardBody,
  Flex,
  Form,
  Label,
  DataList,
  DataListCell,
  DataListCheck,
  DataListItem,
  DataListItemCells,
  DataListItemRow,
  Spinner,
  Split,
  Stack,
  Drawer,
  DrawerPanelContent,
  DrawerPanelBody,
  DrawerContent,
  DrawerContentBody,
  DrawerHead,
  DrawerActions,
  DrawerCloseButton,
  Button
} from "@patternfly/react-core";
import { Icon } from "~/components/layout";

import { WifiConnectionForm } from "~/components/network";
import { DeviceState } from "~/client/network/model";
import { _ } from "~/i18n";
import { ButtonLink } from "../core";
import { useInstallerClient } from "~/context/installer";

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

const Connect = ({ network }) => {
  const client = useInstallerClient();

  return (
    <ButtonLink onClick={async () => await client.network.connectTo(network.settings)}>
      {_("Connect")}
    </ButtonLink>
  );
};

const Disconnect = ({ network }) => {
  const client = useInstallerClient();

  return (
    <ButtonLink onClick={async () => await client.network.disconnect(network.settings)}>
      {_("Disconnect")}
    </ButtonLink>
  );
};

const Forget = ({ network }) => {
  const client = useInstallerClient();

  return (
    <Button variant="secondary" isDanger onClick={async () => await client.network.deleteConnection(network.settings.id)}>
      {_("Forget")}
    </Button>
  );
};

const IpsAndOtherSettings = (network) => {
  // FIXME: show the connection details/settings
  return ("");
};

const WifiDrawerPanelBody = ({ network, onCancel, onConnect }) => {
  if (!network) return;

  const Form = () => <WifiConnectionForm network={network} onCancel={onCancel} />;

  if (network === HIDDEN_NETWORK) return <Form />;

  if (network.settings && !network.device) {
    return (
      <Split hasGutter>
        <Connect network={network} />
        <Forget network={network} />
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
          <IpsAndOtherSettings />
          <Split hasGutter>
            <Disconnect network={network} />
            <Forget network={network} />
          </Split>
        </Stack>
      );
    default:
      return <Form />;
  }
};

const NetworkFormName = ({ network }) => {
  if (!network) return;

  return (
    <h3>
      {network === HIDDEN_NETWORK ? _("Connect to a hidden network") : network.ssid}
    </h3>
  );
};

const NetworkListName = ({ network }) => {
  const state = networkState(network.device?.state);

  return (
    <Flex columnGap={{ default: "columnGapSm" }}>
      <b>{network.ssid}</b>
      {state === _("Connected") && <Label isCompact color="blue">{state}</Label>}
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
function WifiNetworksListPage({
  selected,
  onSelectionChange,
  networks = [],
}) {
  const selectHiddenNetwork = () => {
    onSelectionChange(HIDDEN_NETWORK);
  };

  const selectNetwork = (ssid) => {
    onSelectionChange(networks.find(n => n.ssid === ssid));
  };

  const unselectNetwork = () => {
    onSelectionChange(undefined);
  };

  const renderElements = () => {
    return networks.map(n => {
      return (
        <DataListItem id={n.ssid} key={n.ssid}>
          <DataListItemRow>
            <DataListItemCells
              dataListCells={[
                <DataListCell key="ssid">
                  <Flex direction={{ default: "column" }} rowGap={{ default: "rowGapSm" }}>
                    <NetworkListName network={n} />
                    <Flex alignItems={{ default: "alignItemsCenter" }} columnGap={{ default: "columnGapSm" }}>
                      <div><Icon name="lock" size="10" fill="grey" /> {n.security.join(", ")}</div>
                      <div><Icon name="signal_cellular_alt" size="10" fill="grey" /> {n.strength}</div>
                    </Flex>
                  </Flex>
                </DataListCell>
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
                  <WifiDrawerPanelBody
                    network={selected}
                    onCancel={unselectNetwork}
                  />
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
                <Button variant="link" onClick={selectHiddenNetwork}>
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
