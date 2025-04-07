/*
 * Copyright (c) [2025] SUSE LLC
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
import { useParams } from "react-router-dom";
import { Content } from "@patternfly/react-core";
import { Page } from "~/components/core";
import { useNetworkChanges, useWifiNetworks } from "~/queries/network";
import WifiConnectionForm from "./WifiConnectionForm";
import WifiConnectionDetails from "./WifiConnectionDetails";
import { DeviceState } from "~/types/network";
import { sprintf } from "sprintf-js";
import { _ } from "~/i18n";

export default function WifiNetworkPage() {
  useNetworkChanges();
  const { ssid } = useParams();
  const networks = useWifiNetworks();
  const network = networks.find((c) => c.ssid === ssid);

  if (!network) return "FIXME";

  const connected = network.device?.state === DeviceState.CONNECTED;
  const title = connected
    ? _("Connection details")
    : sprintf(_("Connect to %s network"), network.ssid);

  return (
    <Page>
      <Page.Header>
        <Content component="h2">{title}</Content>
      </Page.Header>
      <Page.Content>
        {!connected && <WifiConnectionForm network={network} />}
        {connected && <WifiConnectionDetails network={network} />}
      </Page.Content>
    </Page>
  );
}
