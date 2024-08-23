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
import { DASDPage, ISCSIPage } from "~/components/storage";
import ProposalPage from "~/components/storage/ProposalPage";
import { Route } from "~/types/routes";
import { N_ } from "~/i18n";
import { probeDASD } from "~/api/dasd";

const PATHS = {
  root: "/storage",
  targetDevice: "/storage/target-device",
  bootingPartition: "/storage/booting-partition",
  spacePolicy: "/storage/space-policy",
  iscsi: "/storage/iscsi",
  dasd: "/storage/dasd"
};

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
      //FIXME: move to the onClick of the DASD SelectOption
      loader: async () => probeDASD()
    },
  ],
});

export default routes;
export { PATHS };
