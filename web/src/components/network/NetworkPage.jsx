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

import React, { useCallback, useEffect, useState } from "react";
import { Button, CardBody, Grid, GridItem, Split, Skeleton, Stack } from "@patternfly/react-core";
import { useLoaderData } from "react-router-dom";
import { ButtonLink, CardField, EmptyState, Page } from "~/components/core";
import { ConnectionsTable } from "~/components/network";
import { NetworkEventTypes } from "~/client/network";
import { useInstallerClient } from "~/context/installer";
import { _ } from "~/i18n";
import { formatIp } from "~/client/network/utils";
import { sprintf } from "sprintf-js";
import { DeviceState } from "~/client/network/model";

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
  const { connections: initialConnections, devices: initialDevices, settings } = useLoaderData();
  const [connections, setConnections] = useState(initialConnections);
  const [devices, setDevices] = useState(initialDevices);
  const [updateState, setUpdateState] = useState(false);

  const fetchState = useCallback(async () => {
    const devices = await client.devices();
    const connections = await client.connections();
    setDevices(devices);
    setConnections(connections);
  }, [client]);

  useEffect(() => {
    if (!updateState) return;

    setUpdateState(false);
    fetchState();
  }, [fetchState, updateState]);

  useEffect(() => {
    return client.onNetworkChange(({ type }) => {
      if ([NetworkEventTypes.DEVICE_ADDED, NetworkEventTypes.DEVICE_UPDATED, NetworkEventTypes.DEVICE_REMOVED].includes(type)) {
        setUpdateState(true);
      }
    });
  });

  const connectionDevice = ({ id }) => devices?.find(({ connection }) => id === connection);
  const connectionAddresses = (connection) => {
    const device = connectionDevice(connection);
    const addresses = device ? device.addresses : connection.addresses;

    return addresses?.map(formatIp).join(", ");
  };

  const ready = (connections !== undefined) && (devices !== undefined);

  const WifiConnections = () => {
    const { wireless_enabled: wifiAvailable } = settings;

    if (!wifiAvailable) {
      return (
        <CardField>
          <CardField.Content>
            <EmptyState title={_("Not supported")} icon="error">
              {_("The system does not support Wi-Fi connections, probably because of missing or disabled hardware.")}
            </EmptyState>
          </CardField.Content>
        </CardField>
      );
    }

    const wifiConnections = connections.filter(c => c.wireless);
    const activeWifiDevice = devices.find(d => d.type === "wireless" && d.state === "activated");
    const activeConnection = wifiConnections.find(c => c.id === activeWifiDevice?.connection);

    return (
      <CardField
        label={_("Wi-Fi")}
        actions={
          <ButtonLink isPrimary={!activeConnection} to="wifis">
            {activeConnection ? _("Change") : _("Connect")}
          </ButtonLink>
        }
      >
        <CardField.Content>
          {activeConnection
            ? (
              <EmptyState title={sprintf(_("Conected to %s"), activeConnection.id)} icon="wifi" color="success-color-100">
                {connectionAddresses(activeConnection)}
              </EmptyState>
            )
            : (
              <EmptyState title={_("No connected yet")} icon="wifi_off" color="color-300">
                {_("The system has not been configured for connecting to a Wi-Fi network yet.")}
              </EmptyState>
            )}
        </CardField.Content>
      </CardField>
    );
  };

  const WiredConnections = () => {
    const wiredConnections = connections.filter(c => !c.wireless);

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
