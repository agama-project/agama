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
import NetworkPage from "./NetworkPage";
import IpSettingsForm from "./IpSettingsForm";
import WifiSelectorPage from "./WifiSelectorPage";
import { N_ } from "~/i18n";

const routes = {
  path: "/network",
  handle: {
    name: N_("Network"),
    icon: "settings_ethernet",
  },
  children: [
    { index: true, element: <NetworkPage /> },
    {
      path: "connections/:id/edit",
      element: <IpSettingsForm />
    },
    {
      path: "wifis",
      element: <WifiSelectorPage />,
    }
  ]
};

export default routes;
