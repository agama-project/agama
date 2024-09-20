/*
 * Copyright (c) [2024] SUSE LLC
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
import { Grid, GridItem } from "@patternfly/react-core";
import { Page } from "~/components/core";
import WifiNetworksListPage from "~/components/network/WifiNetworksListPage";
import { useNetworkConfigChanges } from "~/queries/network";
import { _ } from "~/i18n";

function WifiSelectorPage() {
  useNetworkConfigChanges();

  return (
    <Page>
      <Page.Header>
        <h2>{_("Connect to a Wi-Fi network")}</h2>
      </Page.Header>

      <Page.Content>
        <Grid hasGutter>
          <GridItem sm={12}>
            <WifiNetworksListPage />
          </GridItem>
        </Grid>
      </Page.Content>

      <Page.Actions>
        <Page.Cancel />
      </Page.Actions>
    </Page>
  );
}

export default WifiSelectorPage;
