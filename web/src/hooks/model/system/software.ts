/*
 * Copyright (c) [2025] SUSE LLC
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

import { useSuspenseQuery } from "@tanstack/react-query";
import { fork } from "radashi";
import { systemQuery } from "~/hooks/model/system";
import { useProposal } from "~/hooks/model/proposal/software";
import { useProductInfo } from "~/hooks/model/config/product";
import { isPatternSelected } from "~/utils/software";
import type { System, Software } from "~/model/system";

const selectSystem = (data: System | null): Software.System => data?.software;

function useSystem(): Software.System | null {
  const { data } = useSuspenseQuery({
    ...systemQuery,
    select: selectSystem,
  });
  return data;
}

type AvailablePatterns = {
  all: Software.Pattern[];
  desktops: Software.Pattern[];
  other: Software.Pattern[];
};

/**
 * Retrieves all available patterns categorized by type.
 *
 * Returns three lists:
 * - `all`: every pattern available in the system
 * - `desktops`: patterns flagged as desktop environments
 * - `other`: non-desktop patterns
 */
function useAvailablePatterns(): AvailablePatterns {
  const { patterns } = useSystem();
  const [desktops, other] = fork(patterns, (p) => p.desktop);
  return { all: patterns, desktops, other };
}

/**
 * Retrieves the list of patterns currently selected in the active proposal.
 *
 * Only patterns selected by the user or auto-pulled are included; patterns
 * explicitly removed or not selected at all are excluded.
 */
function useSelectedPatterns() {
  const proposal = useProposal();
  const { patterns } = useSystem();

  if (!proposal) return [];

  return patterns.filter((p) => isPatternSelected(proposal.patterns, p.name));
}

/**
 * Whether the product suggests picking a desktop environment but none is
 * currently selected.
 *
 * Use this to decide whether to hint the user in UI surfaces such as the
 * software summary or the installation confirmation. Returns `false` for
 * products that do not declare `desktopSelection` or declare it as
 * `"optional"`, and also returns `false` when no desktop patterns are
 * available (can't be missing if none exist).
 */
function useIsDesktopMissing(): boolean {
  const product = useProductInfo();
  const selectedPatterns = useSelectedPatterns();
  const { desktops: availableDesktops } = useAvailablePatterns();

  if (product?.desktopSelection !== "suggested") return false;
  if (availableDesktops.length === 0) return false;

  return !selectedPatterns.some((p) => p.desktop);
}

export { useSystem, useSelectedPatterns, useAvailablePatterns, useIsDesktopMissing };
