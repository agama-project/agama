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
import { _ } from "~/i18n";
import { Page } from "~/components/core";
import NetworkPage from "./NetworkPage";
import IpSettingsForm from "./IpSettingsForm";
import { createDefaultClient } from "~/client";
import WifiSelectorPage from "./WifiSelectorPage";

// FIXME: just to be discussed, most probably we should reading data directly in
// the component in order to get it subscribed to changes.
const client = await createDefaultClient();

const loaders = {
  all: async () => {
    const devices = await client.network.devices();
    const connections = await client.network.connections();
    const settings = await client.network.settings();
    return { connections, devices, settings };
  },
  connection: async ({ params }) => {
    const connections = await client.network.connections();
    return connections.find(c => c.id === params.id);
  },
  wifis: async () => {
    const connections = await client.network.connections();
    const devices = await client.network.devices();
    const accessPoints = await client.network.accessPoints();
    const networks = await client.network.loadNetworks(devices, connections, accessPoints);

    return { connections, devices, accessPoints, networks };
  },
};

const routes = {
  path: "/network",
  element: <Page />,
  handle: {
    name: _("Network"),
    icon: "settings_ethernet"
  },
  children: [
    { index: true, element: <NetworkPage />, loader: loaders.all },
    {
      path: "connections/:id/edit",
      element: <IpSettingsForm />,
      loader: loaders.connection,
      handle: {
        name: _("Edit connection %s")
      }
    },
    {
      path: "wifis",
      element: <WifiSelectorPage />,
      loader: loaders.wifis,
    }
  ]
};

export default routes;
