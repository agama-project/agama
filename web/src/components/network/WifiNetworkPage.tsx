/*
 * Copyright (c) [2025-2026] SUSE LLC
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
import { useParams } from "react-router";
import Page from "~/components/core/Page";
import WifiConnectionForm from "~/components/network/WifiConnectionForm";
import WifiConnectionDetails from "~/components/network/WifiConnectionDetails";
import { DeviceState } from "~/types/network";
import { useNetworkChanges, useWifiNetworks } from "~/hooks/model/system/network";
import { NETWORK } from "~/routes/paths";
import { _ } from "~/i18n";

export default function WifiNetworkPage() {
  useNetworkChanges();
  const { ssid } = useParams();
  const networks = useWifiNetworks();
  const network = networks.find((c) => c.ssid === ssid);
  const connected = network?.device?.state === DeviceState.CONNECTED;

  return (
    <Page
      breadcrumbs={[
        { label: _("Network"), path: NETWORK.root },
        { label: _("Wi-Fi") },
        { label: ssid },
      ]}
      progress={{ scope: "network", ensureRefetched: "system" }}
    >
      <Page.Content>
        {!network && <WifiConnectionForm />}
        {network && !connected && <WifiConnectionForm />}
        {network && connected && <WifiConnectionDetails />}
      </Page.Content>
    </Page>
  );
}
