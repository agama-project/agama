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
import { Button, CardBody, Grid, GridItem, Split, Skeleton, Stack } from "@patternfly/react-core";
import { useLoaderData } from "react-router-dom";
import { CardField, EmptyState, Page } from "~/components/core";
import { ConnectionsTable, WifiSelector } from "~/components/network";
import { NetworkEventTypes } from "~/client/network";
import { useInstallerClient } from "~/context/installer";
import { _ } from "~/i18n";
import { formatIp } from "~/client/network/utils";
import { sprintf } from "sprintf-js";

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
 * Page component holding Network settings
 * @component
 */
export default function NetworkPage() {
  const { network: client } = useInstallerClient();
  const { connections: initialConnections, settings } = useLoaderData();
  const [connections, setConnections] = useState(initialConnections);
  const [devices, setDevices] = useState(undefined);

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

  const connectionDevice = ({ id }) => devices?.find(({ connection }) => id === connection);
  const connectionAddresses = (connection) => {
    const device = connectionDevice(connection);
    const addresses = device ? device.addresses : connection.addresses;

    return addresses?.map(formatIp).join(", ");
  };

  const ready = (connections !== undefined) && (devices !== undefined);

  const WifiConnections = () => {
    const wifiConnections = connections.filter(c => c.wireless);
    const { wireless_enabled: wifiAvailable } = settings;
    const activeConnection = wifiAvailable && wifiConnections.find(c => c.status === "up");

    const ConnectionButton = () => {
      if (!wifiAvailable) return;

      return (
        <Button variant={activeConnection ? "primary" : "secondary"}>
          {activeConnection ? _("Change") : _("Connect")}
        </Button>
      );
    };

    const DisconnectionButton = () => {
      if (!wifiAvailable || !activeConnection) return;

      return (
        <Button variant="secondary">{_("Disconnect")}</Button>
      );
    };

    return (
      <CardField
        label={_("Wi-Fi")}
        actions={
          <Split hasGutter>
            <ConnectionButton />
            <DisconnectionButton />
          </Split>
        }
      >
        <CardField.Content>
          {!wifiAvailable &&
            <EmptyState title={_("No WiFi support")} icon="wifi_off" color="warning-color-200">
              {_("The system does not support WiFi connections, probably because of missing or disabled hardware.")}
            </EmptyState>}
          {activeConnection
            ? (
              <EmptyState title={sprintf(_("Conected to %s"), activeConnection.id)} icon="wifi" color="success-color-100">
                {connectionAddresses(activeConnection)}
              </EmptyState>
            )
            : (
              <EmptyState title={_("No connected yet")} icon="wifi_off" color="color-300">
                {_("The system has not been configured for connecting to a WiFi network yet.")}
              </EmptyState>
            )}
        </CardField.Content>
      </CardField>
    );
  };

  const WiredConnections = () => {
    const wiredConnections = connections.filter(c => !c.wireless && (c.id !== "lo"));

    if (wiredConnections.length === 0) return <NoWiredConnections />;

    return <ConnectionsTable connections={wiredConnections} devices={devices} />;
  };

  return (
    <>
      <Page.Header>
        <h2>{_("Network")}</h2>
      </Page.Header>

      <Page.MainContent>
        <Grid hasGutter>
          <GridItem sm={12} xl={6}>
            <CardField label={_("Wired")}>
              <CardBody>
                {ready ? <WiredConnections /> : <Skeleton />}
              </CardBody>
            </CardField>
          </GridItem>
          <GridItem sm={12} xl={6}>
            <WifiConnections />
          </GridItem>
        </Grid>
      </Page.MainContent>
    </>
  );
}
