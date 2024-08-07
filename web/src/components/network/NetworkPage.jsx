/*
 * Copyright (c) [2023-2024] SUSE LLC
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
import { CardBody, Grid, GridItem } from "@patternfly/react-core";
import { ButtonLink, CardField, EmptyState, Page } from "~/components/core";
import { ConnectionsTable } from "~/components/network";
import { _ } from "~/i18n";
import { connectionAddresses } from "~/utils/network";
import { sprintf } from "sprintf-js";
import { useNetwork, useNetworkConfigChanges } from "~/queries/network";
import { PATHS } from "~/routes/network";
import { partition } from "~/utils";

const WiredConnections = ({ connections, devices }) => {
  const total = connections.length;

  return (
    <CardField label={total > 0 && _("Wired")}>
      <CardBody>
        {total === 0 && <EmptyState title={_("No wired connections found")} icon="warning" />}
        {total !== 0 && <ConnectionsTable connections={connections} devices={devices} />}
      </CardBody>
    </CardField>
  );
};

const WifiConnections = ({ connections, devices }) => {
  const activeWifiDevice = devices.find((d) => d.type === "wireless" && d.state === "activated");
  const activeConnection = connections.find((c) => c.id === activeWifiDevice?.connection);

  return (
    <CardField
      label={_("Wi-Fi")}
      actions={
        <ButtonLink isPrimary={!activeConnection} to={PATHS.wifis}>
          {activeConnection ? _("Change") : _("Connect")}
        </ButtonLink>
      }
    >
      <CardField.Content>
        {activeConnection ? (
          <EmptyState
            title={sprintf(_("Connected to %s"), activeConnection.id)}
            icon="wifi"
            color="success-color-100"
          >
            {connectionAddresses(activeConnection, devices)}
          </EmptyState>
        ) : (
          <EmptyState title={_("No connected yet")} icon="wifi_off" color="color-300">
            {_("The system has not been configured for connecting to a Wi-Fi network yet.")}
          </EmptyState>
        )}
      </CardField.Content>
    </CardField>
  );
};

const NoWifiAvailable = () => (
  <CardField>
    <CardField.Content>
      <EmptyState title={_("No Wi-Fi supported")} icon="error">
        {_(
          "The system does not support Wi-Fi connections, probably because of missing or disabled hardware.",
        )}
      </EmptyState>
    </CardField.Content>
  </CardField>
);

/**
 * Page component holding Network settings
 */
export default function NetworkPage() {
  useNetworkConfigChanges();
  const { connections, devices, settings, accessPoints } = useNetwork();
  const [wifiConnections, wiredConnections] = partition(connections, (c) => c.wireless);

  return (
    <Page>
      <Page.Header>
        <h2>{_("Network")}</h2>
      </Page.Header>

      <Page.MainContent>
        <Grid hasGutter>
          <GridItem sm={12} xl={6}>
            <WiredConnections connections={wiredConnections} devices={devices} />
          </GridItem>
          <GridItem sm={12} xl={6}>
            {settings.wireless_enabled ? (
              <WifiConnections connections={wifiConnections} devices={devices} />
            ) : (
              <NoWifiAvailable />
            )}
          </GridItem>
        </Grid>
      </Page.MainContent>
    </Page>
  );
}
