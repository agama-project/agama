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

import { shake } from "radashi";
import { useSuspenseQuery } from "@tanstack/react-query";
import { systemQuery } from "~/hooks/model/system";
import { useProposal } from "~/hooks/model/proposal/software";
import { SelectedBy } from "~/model/proposal/software";
import type { System, Software } from "~/model/system";

const selectSystem = (data: System | null): Software.System => data?.software;

function useSystem(): Software.System | null {
  const { data } = useSuspenseQuery({
    ...systemQuery,
    select: selectSystem,
  });
  return data;
}

/**
 * Retrieves the list of patterns currently selected in the active proposal.
 */
function useSelectedPatterns() {
  const proposal = useProposal();
  const { patterns } = useSystem();

  const selectedPatternsKeys = Object.keys(
    shake(proposal.patterns, (value) => value === SelectedBy.NONE),
  );

  return patterns.filter((p) => selectedPatternsKeys.includes(p.name));
}

export { useSystem, useSelectedPatterns };
