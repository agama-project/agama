/*
 * Copyright (c) [2023] SUSE LLC
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

// @ts-check

import React, { useEffect, useState } from "react";
import { useLoaderData } from "react-router-dom";
import { Button, CardBody, Flex, Grid, GridItem, Skeleton, Stack } from "@patternfly/react-core";
import { useInstallerClient } from "~/context/installer";
import { CardField, Page } from "~/components/core";
import { ConnectionsTable, WifiSelector } from "~/components/network";
import { NetworkEventTypes } from "~/client/network";
import { _ } from "~/i18n";

const WifiSelection = ({ wifiScanSupported }) => {
  const [wifiSelectorOpen, setWifiSelectorOpen] = useState(false);

  if (!wifiScanSupported) return;

  const openWifiSelector = () => setWifiSelectorOpen(true);
  const closeWifiSelector = () => setWifiSelectorOpen(false);

  return (
    <>
      <Button variant="secondary" onClick={openWifiSelector}>
        {_("Connect to a Wi-Fi network")}
      </Button>
      <WifiSelector isOpen={wifiSelectorOpen} onClose={closeWifiSelector} />
    </>
  );
};

/**
 * Internal component for displaying info when none wire connection is found
 * @component
 */
const NoWiredConnections = () => {
  return (
    <div>{_("No wired connections found.")}</div>
  );
};

/**
 * Internal component for displaying info when none WiFi connection is found
 * @component
 *
 * @param {object} props
 * @param {boolean} props.supported - whether the system supports scanning WiFi networks
 * @param {boolean} props.openWifiSelector - the function for opening the WiFi selector
 */
const NoWifiConnections = ({ wifiScanSupported }) => {
  const message = wifiScanSupported
    ? _("The system has not been configured for connecting to a WiFi network yet.")
    : _("The system does not support WiFi connections, probably because of missing or disabled hardware.");

  return (
    <Stack hasGutter>
      <div>{_("No WiFi connections found.")}</div>
      <div>{message}</div>
    </Stack>
  );
};

/**
 * Page component holding Network settings
 * @component
 */
export default function NetworkPage() {
  const { network: client } = useInstallerClient();
  const { connections: initialConnections, settings } = useLoaderData();
  const [connections, setConnections] = useState(initialConnections);
  const [devices, setDevices] = useState(undefined);
  const [selectedConnection, setSelectedConnection] = useState(null);

  useEffect(() => {
    return client.onNetworkChange(({ type, payload }) => {
      switch (type) {
        case NetworkEventTypes.DEVICE_ADDED: {
          setDevices((devs) => {
            const newDevices = devs.filter((d) => d.name !== payload.name);
            return [...newDevices, client.fromApiDevice(payload)];
          });
          break;
        }

        case NetworkEventTypes.DEVICE_UPDATED: {
          const [name, data] = payload;
          setDevices(devs => {
            const newDevices = devs.filter((d) => d.name !== name);
            return [...newDevices, client.fromApiDevice(data)];
          });
          break;
        }

        case NetworkEventTypes.DEVICE_REMOVED: {
          setDevices(devs => devs.filter((d) => d.name !== payload));
          break;
        }
      }
      client.connections().then(setConnections);
    });
  }, [client, devices]);

  useEffect(() => {
    if (devices !== undefined) return;

    client.devices().then(setDevices);
  }, [client, devices]);

  const selectConnection = ({ id }) => {
    client.getConnection(id).then(setSelectedConnection);
  };

  const forgetConnection = async ({ id }) => {
    await client.deleteConnection(id);
    setConnections(undefined);
  };

  const updateConnections = async () => {
    setConnections(undefined);
    setDevices(undefined);
  };

  const ready = (connections !== undefined) && (devices !== undefined);

  const WifiConnections = () => {
    const wifiConnections = connections.filter(c => c.wireless);

    if (wifiConnections.length === 0) {
      return (
        <NoWifiConnections wifiScanSupported={settings.wireless_enabled} />
      );
    }

    return (
      <ConnectionsTable connections={wifiConnections} devices={devices} onEdit={selectConnection} onForget={forgetConnection} />
    );
  };

  const WiredConnections = () => {
    const wiredConnections = connections.filter(c => !c.wireless && (c.id !== "lo"));

    if (wiredConnections.length === 0) return <NoWiredConnections />;

    return <ConnectionsTable connections={wiredConnections} devices={devices} onEdit={selectConnection} />;
  };

  return (
    <>
      <Page.Header>
        <Flex justifyContent={{ default: "justifyContentSpaceBetween" }}>
          <h2>{_("Network")}</h2>
          <WifiSelection wifiScanSupported={settings.wireless_enabled} />
        </Flex>
      </Page.Header>

      <Page.MainContent>
        <Grid hasGutter>
          <GridItem sm={12}>
            <CardField label={_("Wired connections")}>
              <CardBody>
                {ready ? <WiredConnections /> : <Skeleton />}
              </CardBody>
            </CardField>
          </GridItem>
          <GridItem sm={12}>
            <CardField label={_("WiFi connections")}>
              <CardBody>
                {ready ? <WifiConnections /> : <Skeleton />}
              </CardBody>
            </CardField>
          </GridItem>
        </Grid>
      </Page.MainContent>
    </>
  );
}
