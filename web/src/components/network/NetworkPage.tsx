/*
 * Copyright (c) [2023-2025] SUSE LLC
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
import { Content, Grid, GridItem } from "@patternfly/react-core";
import { EmptyState, Page } from "~/components/core";
import { useNetworkChanges } from "~/queries/network";
import WifiNetworksList from "./WifiNetworksList";
import WiredConnectionsList from "./WiredConnectionsList";
import NoPersistentConnectionsAlert from "./NoPersistentConnectionsAlert";
import { _ } from "~/i18n";
import { useSystem } from "~/queries/system";

const NoWifiAvailable = () => (
  <Page.Section>
    <EmptyState title={_("Wi-Fi not supported")} icon="error">
      {_(
        "The system does not support Wi-Fi connections, probably because of missing or disabled hardware.",
      )}
    </EmptyState>
  </Page.Section>
);

/**
 * Page component holding Network settings
 */
export default function NetworkPage() {
  useNetworkChanges();
  const { network: networkSystem } = useSystem();

  return (
    <Page>
      <Page.Header>
        <Content component="h2">{_("Network")}</Content>
      </Page.Header>

      <Page.Content>
        <NoPersistentConnectionsAlert />

        <Grid hasGutter>
          <GridItem sm={12} xl={6}>
            <Page.Section title={_("Wired connections")}>
              <WiredConnectionsList aria-label={_("Wired connections")} />
            </Page.Section>
          </GridItem>
          <GridItem sm={12} xl={6}>
            {networkSystem.wirelessEnabled ? (
              <Page.Section title={_("Wi-Fi networks")}>
                <WifiNetworksList aria-label={_("Wi-Fi networks")} />
              </Page.Section>
            ) : (
              <NoWifiAvailable />
            )}
          </GridItem>
        </Grid>
      </Page.Content>
    </Page>
  );
}
