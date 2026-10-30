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
import { Flex } from "@patternfly/react-core";
import FixableConfigInfo, { fixableConfigTitle } from "~/components/storage/FixableConfigInfo";
import ProposalFailedInfo, { proposalFailedTitle } from "~/components/storage/ProposalFailedInfo";
import UnsupportedModelInfo from "~/components/storage/UnsupportedModelInfo";
import InvalidConfigMessage from "~/components/storage/storage-page/InvalidConfigMessage";
import NoDevicesMessage from "~/components/storage/storage-page/NoDevicesMessage";
import UnknownConfigMessage from "~/components/storage/storage-page/UnknownConfigMessage";
import { useAvailableDevices } from "~/hooks/model/system/storage";
import { useIssues } from "~/hooks/model/issue";
import { useProposal } from "~/hooks/model/proposal/storage";
import { useConfigModel } from "~/hooks/model/storage/config-model";
import Consequences, { summaryOf } from "~/components/storage/storage-page/Consequences";
import { useAnnounce } from "~/context/announcer";
import type { TranslatedString } from "~/i18n";

/** Whether the alert reports a plan or a problem. */
type AlertKind = "success" | "problem";

/**
 * Says the alert to screen readers when it turns from a plan into a problem or
 * back, but not on the first render, and not when only its numbers change.
 *
 * A change made in the panel below can flip the alert, which a sighted reader
 * sees and a screen reader user working in the panel does not. New counts are
 * left unsaid: they would talk over the summary the panel itself announces on
 * every change.
 */
function useAnnounceKind(kind: AlertKind | null, title: TranslatedString) {
  const announce = useAnnounce();
  const announcedKind = React.useRef(kind);

  React.useEffect(() => {
    if (announcedKind.current === kind) return;

    const previous = announcedKind.current;
    announcedKind.current = kind;
    if (previous && kind) announce(title);
  }, [kind, title, announce]);
}

/**
 * What the storage page reports about its configuration.
 *
 * Where a layout could be calculated, that is what the installer will do to
 * the disks, as plain text: an ordinary plan is not a notice, so alerts are
 * kept for the states that need the reader's attention. Those are the
 * configuration being invalid, unknown or unsupported, there being no devices
 * to install on, and the installer failing to find a layout.
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

  const isNoDevices = availableDevices.length === 0;
  const isInvalid = configIssues.length > 0 && !isModelEditable;
  const isUnknown = configIssues.length === 0 && !model && !proposal;
  const isReplaced = isNoDevices || isInvalid || isUnknown;

  /* The states that replace the page have no alert to flip, so they are not
     a kind of alert. */
  let kind: AlertKind | null = null;
  if (!isReplaced) kind = proposal ? "success" : "problem";

  let title = proposalFailedTitle();
  if (proposal) {
    title = summaryOf(proposal.actions || []);
  } else if (configIssues.length) {
    title = fixableConfigTitle(configIssues);
  }

  useAnnounceKind(kind, title);

  if (isNoDevices) return <NoDevicesMessage />;
  if (isInvalid) return <InvalidConfigMessage issues={configIssues} />;
  if (isUnknown) return <UnknownConfigMessage />;
  if (proposal) return <Consequences />;

  /* A flex column rather than a stack, which takes the whole height of what
     holds it: inside a column of its own, that leaves a gap under the alerts
     and squeezes whatever comes after them. */
  return (
    <Flex direction={{ default: "column" }} gap={{ default: "gapMd" }}>
      {configIssues.length ? <FixableConfigInfo issues={configIssues} /> : <ProposalFailedInfo />}
      {!model && <UnsupportedModelInfo />}
    </Flex>
  );
}
