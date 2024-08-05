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
import { Icon } from "~/components/layout";
import { WifiConnectionForm } from "~/components/network";
import { ButtonLink } from "~/components/core";
import { PATHS } from "~/routes/network";
import { DeviceState } from "~/types/network";
import { _ } from "~/i18n";
import { formatIp } from "~/utils/network";
import {
  useNetwork,
  useRemoveConnectionMutation,
  useSelectedWifi,
  useSelectedWifiChange,
  useWifiNetworks,
} from "~/queries/network";

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

// FIXME: too similar to utils/network#connectionAddresses method. Try to join them.
const connectionAddresses = (network) => {
  const { device, settings } = network;
  const addresses = device ? device.addresses : settings?.addresses;

  return addresses?.map(formatIp).join(", ");
};

const ConnectionData = ({ network }) => {
  return <Stack hasGutter>{connectionAddresses(network)}</Stack>;
};

const WifiDrawerPanelBody = ({ network, onCancel }) => {
  const { mutate: removeConnection } = useRemoveConnectionMutation();
  const { data } = useSelectedWifi();

  const forgetNetwork = async () => {
    removeConnection(network.settings.id);
  };

  if (!network) return;

  const Form = () => <WifiConnectionForm network={network} onCancel={onCancel} />;

  if (network === HIDDEN_NETWORK) return <Form />;

  if (data.needsAuth) return <Form />;

  if (network.settings && !network.device) {
    return (
      <Split hasGutter>
        <ButtonLink onClick={async () => await network.connectTo(network.settings)}>
          {_("Connect")}
        </ButtonLink>
        <ButtonLink to={generatePath(PATHS.editConnection, { id: network.settings.id })}>
          {_("Edit")}
        </ButtonLink>
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
            <ButtonLink onClick={async () => await network.disconnect(network.settings)}>
              {_("Disconnect")}
            </ButtonLink>
            <ButtonLink to={generatePath(PATHS.editConnection, { id: network.settings.id })}>
              {_("Edit")}
            </ButtonLink>
            <Button variant="secondary" isDanger onClick={forgetNetwork}>
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

const NetworkListName = ({ network, ...props }) => {
  const state = networkState(network.device?.state);

  return (
    <Flex columnGap={{ default: "columnGapXs" }}>
      <b {...props}>{network.ssid}</b>
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

const NetworkListItem = ({ network }) => {
  const headerId = `network-${network.ssid}`;
  return (
    <DataListItem id={network.ssid} aria-labelledby={headerId}>
      <DataListItemRow>
        <DataListItemCells
          dataListCells={[
            <DataListCell key="ssid">
              <Flex direction={{ default: "column" }} rowGap={{ default: "rowGapSm" }}>
                <NetworkListName id={headerId} network={network} />
                <Flex
                  alignItems={{ default: "alignItemsCenter" }}
                  columnGap={{ default: "columnGapSm" }}
                >
                  <div>
                    <Icon name="lock" size="10" fill="grey" /> {network.security.join(", ")}
                  </div>
                  <div>
                    <Icon name="signal_cellular_alt" size="10" fill="grey" /> {network.strength}
                  </div>
                </Flex>
              </Flex>
            </DataListCell>,
          ]}
        />
      </DataListItemRow>
    </DataListItem>
  );
};

// FIXME: Question: why do we need to do this? Can it be done directly in the useNetwork query?
const networksFromValues = (networks) => Object.values(networks).flat();

/**
 * Component for displaying a list of available Wi-Fi networks
 */
function WifiNetworksListPage() {
  const /** @type import("~/types/network").WifiNetw */ networks = useWifiNetworks();
  const { ssid: selectedSsid } = useSelectedWifi();
  const selected =
    selectedSsid === undefined ? HIDDEN_NETWORK : networks.find((n) => n.ssid === selectedSsid);
  const { mutate: changeSelection } = useSelectedWifiChange();

  const selectHiddneNetwork = () => {
    changeSelection({ ssid: undefined, needsAuth: null });
  };

  const selectNetwork = (ssid) => {
    changeSelection({ ssid, needsAuth: null });
  };

  const unselectNetwork = () => {
    changeSelection({ ssid: null, needsAuth: null });
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
                  {networks.map((n) => (
                    <NetworkListItem key={n.ssid} network={n} />
                  ))}
                </DataList>
                <Button
                  variant="link"
                  isDisabled={selected === HIDDEN_NETWORK}
                  onClick={selectHiddneNetwork}
                >
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
