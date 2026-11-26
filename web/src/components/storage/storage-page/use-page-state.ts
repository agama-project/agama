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

import { useAvailableDevices } from "~/hooks/model/system/storage";
import { useIssues } from "~/hooks/model/issue";
import { useProposal } from "~/hooks/model/proposal/storage";
import { useConfigModel } from "~/hooks/model/storage/config-model";
import type { Issue } from "~/model/issue";

/** Issue classes the configuration can still be edited with, here. */
const FIXABLE = [
  "configNoRoot",
  "configMissingPaths",
  "configOverusedPvTarget",
  "configMisusedMdMember",
  "configMisusedPv",
  "proposal",
];

/** What the storage page shows: a state replacing it, or the page itself. */
type PageState =
  /** There is no disk to install on. */
  | { kind: "noDevices" }
  /** The configuration has issues that cannot be fixed with this interface. */
  | { kind: "invalid"; issues: Issue[] }
  /** The configuration cannot be represented here, and nothing is wrong with it. */
  | { kind: "unknown"; hasProposal: boolean }
  /** The configuration can be shown and edited. */
  | { kind: "page" };

/**
 * Decides what the storage page shows. The first matching state wins.
 *
 * Issues and a proposal never come together, so a configuration with issues
 * that cannot be fixed here never shows the page.
 */
function usePageState(): PageState {
  const model = useConfigModel();
  const availableDevices = useAvailableDevices();
  const proposal = useProposal();
  const issues = useIssues("storage");
  const configIssues = issues.filter((i) => i.class !== "proposal");
  const hasUnfixableIssues = issues.some((i) => !FIXABLE.includes(i.class));

  if (availableDevices.length === 0) return { kind: "noDevices" };
  if (configIssues.length > 0 && (!model || hasUnfixableIssues)) {
    return { kind: "invalid", issues: configIssues };
  }
  if (!model) return { kind: "unknown", hasProposal: !!proposal };
  return { kind: "page" };
}

export { usePageState };
export type { PageState };
