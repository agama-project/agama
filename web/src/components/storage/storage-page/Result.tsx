/*
 * Copyright (c) [2026] SUSE LLC
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
import { Alert } from "@patternfly/react-core";
import FixableConfigInfo from "~/components/storage/FixableConfigInfo";
import ProposalFailedInfo from "~/components/storage/ProposalFailedInfo";
import UnsupportedModelInfo from "~/components/storage/UnsupportedModelInfo";
import InvalidConfigMessage from "~/components/storage/storage-page/InvalidConfigMessage";
import NoDevicesMessage from "~/components/storage/storage-page/NoDevicesMessage";
import UnknownConfigMessage from "~/components/storage/storage-page/UnknownConfigMessage";
import { _ } from "~/i18n";
import { useAvailableDevices } from "~/hooks/model/system/storage";
import { useIssues } from "~/hooks/model/issue";
import { useProposal } from "~/hooks/model/proposal/storage";
import { useConfigModel } from "~/hooks/model/storage/config-model";
import Consequences from "~/components/storage/storage-page/Consequences";

/**
 * What the storage page says about the one device its configuration is about,
 * where the installer could not work out a layout for it.
 *
 * The installer reports the failure and not its cause, so a page that only
 * passes that on leaves the reader with nothing to press. Naming the decision
 * that produced it turns the report into an instruction: not "no layout could
 * be calculated" but "everything on vdd is being kept, so allow the installer
 * to shrink or delete what is there".
 *
 * Each case names the way out as well as the cause, and both ways out are
 * offered on the page: the decision above this line, and the offer under it.
 */
export default function Result(): React.ReactNode {
  const model = useConfigModel();
  const availableDevices = useAvailableDevices();
  const proposal = useProposal();
  const issues = useIssues("storage");
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

  if (proposal) {
    return (
      <Alert
        isInline
        variant="success"
        component="h3"
        title={_("Text about proposal successfully computed")}
      >
        <Consequences />
      </Alert>
    );
  }

  return (
    <>
      {!configIssues.length && !proposal && <ProposalFailedInfo />}
      {!!configIssues.length && <FixableConfigInfo issues={configIssues} />}
      {!model && <UnsupportedModelInfo />}
    </>
  );
}
