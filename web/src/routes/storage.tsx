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
import BootSelection from "~/components/storage/BootSelection";
import SpacePolicySelection from "~/components/storage/SpacePolicySelection";
import { DeviceSelection, ISCSIPage, ProposalPage } from "~/components/storage";

import { Route } from "~/types/routes";
import { supportedDASD, probeDASD } from "~/api/storage/dasd";
import { probeZFCP, supportedZFCP } from "~/api/storage/zfcp";
import { redirect } from "react-router-dom";
import { ZFCPPage, ZFCPDiskActivationPage } from "~/components/storage/zfcp";
import { DASDPage } from "~/components/storage/dasd";
import { STORAGE as PATHS } from "~/routes/paths";
import { N_ } from "~/i18n";

const routes = (): Route => ({
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
    {
      path: PATHS.dasd,
      element: <DASDPage />,
      handle: { name: N_("DASD") },
      loader: async () => {
        if (!supportedDASD()) return redirect(PATHS.targetDevice);
        return probeDASD();
      },
    },
    {
      path: PATHS.zfcp.root,
      element: <ZFCPPage />,
      handle: { name: N_("ZFCP") },
      loader: async () => {
        if (!supportedZFCP()) return redirect(PATHS.targetDevice);
        return probeZFCP();
      },
    },
    {
      path: PATHS.zfcp.activateDisk,
      element: <ZFCPDiskActivationPage />,
      loader: async () => {
        if (!supportedZFCP()) return redirect(PATHS.targetDevice);
        return probeZFCP();
      },
    },
  ],
});

export default routes;
export { PATHS };
