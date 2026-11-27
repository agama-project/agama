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

import { useEffect, useRef } from "react";
import { proposalFailedTitle } from "~/components/storage/ProposalFailedInfo";
import { fixableConfigTitle } from "~/components/storage/FixableConfigInfo";
import { summaryOf } from "~/components/storage/storage-page/Consequences";
import { usePageState } from "~/components/storage/storage-page/use-page-state";
import { useIssues } from "~/hooks/model/issue";
import { useProposal } from "~/hooks/model/proposal/storage";
import { useAnnounce } from "~/context/announcer";
import type { TranslatedString } from "~/i18n";

/** Whether the alert reports a plan or a problem. */
type AlertKind = "success" | "problem";

/**
 * Announces the alert when it turns from a plan into a problem or back, so
 * screen reader users working in the panel learn about it. Not on the first
 * render, and not when only its numbers change.
 */
function useAnnounceKind(kind: AlertKind | null, title: TranslatedString) {
  const announce = useAnnounce();
  const announcedKind = useRef(kind);

  useEffect(() => {
    if (announcedKind.current === kind) return;

    const previous = announcedKind.current;
    announcedKind.current = kind;
    if (previous && kind) announce(title);
  }, [kind, title, announce]);
}

/**
 * Announces the result at the top of the storage page when it turns from a
 * plan into a problem or back.
 */
export default function useAnnounceResult() {
  const proposal = useProposal();
  const issues = useIssues("storage");
  const configIssues = issues.filter((i) => i.class !== "proposal");
  const state = usePageState();

  let kind: AlertKind | null = null;
  if (state.kind === "page") kind = proposal ? "success" : "problem";

  let title = proposalFailedTitle();
  if (proposal) {
    title = summaryOf(proposal.actions || []);
  } else if (configIssues.length) {
    title = fixableConfigTitle();
  }

  useAnnounceKind(kind, title);
}
