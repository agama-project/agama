/*
 * Copyright (c) [2024-2026] SUSE LLC
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
import { redirect } from "react-router";
import { N_ } from "~/i18n";
import { Route } from "~/types/routes";
import BootSelectionPage from "~/components/storage/BootSelectionPage";
import EncryptionSettingsPage from "~/components/storage/EncryptionSettingsPage";
import SpacePolicySelectionPage from "~/components/storage/SpacePolicySelectionPage";
import ProposalPage from "~/components/storage/ProposalPage";
import ISCSIPage from "~/components/storage/ISCSIPage";
import FormattableDevicePage from "~/components/storage/FormattableDevicePage";
import PartitionPage from "~/components/storage/PartitionPage";
import LvmPage from "~/components/storage/LvmPage";
import LogicalVolumePage from "~/components/storage/LogicalVolumePage";
import ZFCPPage from "~/components/storage/zfcp/ZFCPPage";
import ZFCPDiskActivationPage from "~/components/storage/zfcp/ZFCPDiskActivationPage";
import DASDPage from "~/components/storage/dasd/DASDPage";
import TargetsPage from "~/components/storage/iscsi/TargetsPage";
import TargetLoginPage from "~/components/storage/iscsi/TargetLoginPage";
import DeviceSelectorPage from "~/components/storage/DeviceSelectorPage";
import { supportedDASD, probeDASD } from "~/model/storage/dasd";
import { probeZFCP, supportedZFCP } from "~/model/storage/zfcp";
import { STORAGE as PATHS } from "~/routes/paths";
import InitiatorFormPage from "~/components/storage/iscsi/InitiatorFormPage";

const routes = (): Route => ({
  path: PATHS.root,
  handle: { name: N_("Storage"), icon: "hard_drive" },
  children: [
    {
      index: true,
      element: <ProposalPage />,
    },
    {
      path: PATHS.editBootDevice,
      element: <BootSelectionPage />,
    },
    {
      path: PATHS.selectDevice,
      element: <DeviceSelectorPage />,
    },
    {
      path: PATHS.editEncryption,
      element: <EncryptionSettingsPage />,
    },
    {
      path: PATHS.editSpacePolicy,
      element: <SpacePolicySelectionPage />,
    },
    {
      path: PATHS.formatDevice,
      element: <FormattableDevicePage />,
    },
    {
      path: PATHS.addPartition,
      element: <PartitionPage />,
    },
    {
      path: PATHS.editPartition,
      element: <PartitionPage />,
    },
    {
      path: PATHS.volumeGroup.add,
      element: <LvmPage />,
    },
    {
      path: PATHS.volumeGroup.edit,
      element: <LvmPage />,
    },
    {
      path: PATHS.volumeGroup.logicalVolume.add,
      element: <LogicalVolumePage />,
    },
    {
      path: PATHS.volumeGroup.logicalVolume.edit,
      element: <LogicalVolumePage />,
    },
    {
      path: PATHS.iscsi.root,
      element: <ISCSIPage />,
    },
    {
      path: PATHS.iscsi.initiator,
      element: <InitiatorFormPage />,
    },
    {
      path: PATHS.iscsi.discover,
      element: <TargetsPage />,
    },
    {
      path: PATHS.iscsi.login,
      element: <TargetLoginPage />,
    },
    {
      path: PATHS.dasd,
      element: <DASDPage />,
      handle: { name: N_("DASD") },
      loader: async () => {
        if (!supportedDASD()) return redirect(PATHS.root);
        return probeDASD();
      },
    },
    {
      path: PATHS.zfcp.root,
      element: <ZFCPPage />,
      handle: { name: N_("ZFCP") },
      loader: async () => {
        if (!supportedZFCP()) return redirect(PATHS.root);
        return probeZFCP();
      },
    },
    {
      path: PATHS.zfcp.activateDisk,
      element: <ZFCPDiskActivationPage />,
      loader: async () => {
        if (!supportedZFCP()) return redirect(PATHS.root);
        return probeZFCP();
      },
    },
  ],
});

export default routes;
export { PATHS };
