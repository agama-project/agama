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
import BootSelection from "~/components/storage/BootSelection";
import DeviceSelection from "~/components/storage/DeviceSelection";
import SpacePolicySelection from "~/components/storage/SpacePolicySelection";
import { DASDPage, ISCSIPage, ZFCPPage } from "~/components/storage";
import ProposalPage from "~/components/storage/ProposalPage";
import { Route } from "~/types/routes";
import { N_ } from "~/i18n";
import { DASDSupported, probeDASD } from "~/api/dasd";
import { ZFCPSupported, probeZFCP } from "~/api/zfcp";

const PATHS = {
  root: "/storage",
  targetDevice: "/storage/target-device",
  bootingPartition: "/storage/booting-partition",
  spacePolicy: "/storage/space-policy",
  iscsi: "/storage/iscsi",
  dasd: "/storage/dasd",
  zfcp: "/storage/zfcp"
};

const routes = (): Route => {
  const dasdRoute = {
    path: PATHS.dasd,
    element: <DASDPage />,
    handle: { name: N_("DASD") },
    loader: async () => probeDASD(),
  };

  const zfcpRoute = {
    path: PATHS.zfcp,
    element: <ZFCPPage />,
    handle: { name: N_("zFCP") },
    loader: async () => probeZFCP(),
  };

  const routes = {
    path: PATHS.root,
    handle: { name: N_("Storage"), icon: "hard_drive" },
    children: [
      {
        index: true,
        element: <ProposalPage />,
      },
      {
        path: PATHS.targetDevice,
        element: <DeviceSelection />,
      },
      {
        path: PATHS.bootingPartition,
        element: <BootSelection />,
      },
      {
        path: PATHS.spacePolicy,
        element: <SpacePolicySelection />,
      },
      {
        path: PATHS.iscsi,
        element: <ISCSIPage />,
        handle: { name: N_("iSCSI") },
      },
    ],
  };

  if (DASDSupported()) routes.children.push(dasdRoute);
  if (ZFCPSupported()) routes.children.push(zfcpRoute);

  return routes;
};

export default routes;
export { PATHS };
