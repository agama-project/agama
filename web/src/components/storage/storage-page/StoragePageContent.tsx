/*
 * Copyright (c) [2022-2026] SUSE LLC
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
import { Grid } from "@patternfly/react-core";
import FixableConfigInfo from "~/components/storage/FixableConfigInfo";
import ProposalFailedInfo from "~/components/storage/ProposalFailedInfo";
import UnsupportedModelInfo from "~/components/storage/UnsupportedModelInfo";
import ConfigurationSummary from "~/components/storage/storage-page/ConfigurationSummary";
import InvalidConfigMessage from "~/components/storage/storage-page/InvalidConfigMessage";
import NoDevicesMessage from "~/components/storage/storage-page/NoDevicesMessage";
import UnknownConfigMessage from "~/components/storage/storage-page/UnknownConfigMessage";
import StorageSheet from "~/components/storage/storage-page/StorageSheet";
import TopLine from "~/components/storage/storage-page/TopLine";
import { useNoRoomReason } from "~/components/storage/storage-page/queries";
import { useAvailableDevices } from "~/hooks/model/system/storage";
import { useIssues } from "~/hooks/model/issue";
import { useProposal } from "~/hooks/model/proposal/storage";
import { useConfigModel } from "~/hooks/model/storage/config-model";

/**
 * What the storage page shows, and where everything it needs is read.
 *
 * The page has three states that replace it entirely, so they are picked before
 * anything else is arranged: no disk to install on, settings this interface
 * cannot read, and a configuration it knows nothing about.
 *
 * Everything else is the page, with the sheet the page opens over it. The sheet
 * wraps rather than sits beside, because two of its three placements are about
 * what the page does while it is open.
 */
export default function StoragePageContent(): React.ReactNode {
  const model = useConfigModel();
  const availableDevices = useAvailableDevices();
  const proposal = useProposal();
  const issues = useIssues("storage");
  const noRoomReason = useNoRoomReason();

  const fixable = [
    "configNoRoot",
    "configMissingPaths",
    "configOverusedPvTarget",
    "configMisusedMdMember",
    "configMisusedPv",
    "proposal",
  ];
  const configIssues = issues.filter((i) => i.class !== "proposal");
  const unfixableIssues = issues.filter((i) => !fixable.includes(i.class));
  const isModelEditable = model && !unfixableIssues.length;

  if (!availableDevices.length) return <NoDevicesMessage />;
  if (configIssues.length && !isModelEditable)
    return <InvalidConfigMessage issues={configIssues} />;
  if (!configIssues.length && !model && !proposal) return <UnknownConfigMessage />;

  const body = (
    <Grid hasGutter>
      {/* The general account of a failed layout, which names the mount paths it
          could not place. Left out where the summary already says why, since
          the same failure told twice reads as two problems. */}
      {!configIssues.length && !proposal && !noRoomReason && <ProposalFailedInfo />}
      {!!configIssues.length && <FixableConfigInfo issues={configIssues} />}
      {!model && <UnsupportedModelInfo />}
      {model && <TopLine />}
      {model && <ConfigurationSummary />}
    </Grid>
  );

  return <StorageSheet page={body} />;
}
