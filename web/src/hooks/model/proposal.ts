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

import React from "react";
import { useSuspenseQuery, useQueryClient } from "@tanstack/react-query";
import { getProposal } from "~/api";
import { useInstallerClient } from "~/context/installer";
import type { Proposal } from "~/model/proposal";
import { EXTENDED_CONFIG_KEY } from "~/hooks/model/config";
import { STORAGE_MODEL_KEY } from "~/hooks/model/storage/config-model";

const PROPOSAL_KEY = "proposal" as const;
const COMMON_PROPOSAL_KEYS = [PROPOSAL_KEY, EXTENDED_CONFIG_KEY] as const;

const proposalQuery = {
  queryKey: [PROPOSAL_KEY],
  queryFn: getProposal,
};

function useProposal(): Proposal | null {
  return useSuspenseQuery(proposalQuery)?.data;
}

function useProposalChanges() {
  const queryClient = useQueryClient();
  const client = useInstallerClient();

  React.useEffect(() => {
    if (!client) return;

    // TODO: replace the scope instead of invalidating the query.
    return client.onEvent((event) => {
      if (event.type === "ProposalChanged") {
        [...COMMON_PROPOSAL_KEYS, STORAGE_MODEL_KEY].forEach((queryKey) => {
          queryClient.invalidateQueries({ queryKey: [queryKey] });
        });
      }
    });
  }, [client, queryClient]);
}

export { COMMON_PROPOSAL_KEYS, proposalQuery, useProposal, useProposalChanges };
export * as l10n from "~/hooks/model/proposal/l10n";
export * as network from "~/hooks/model/proposal/network";
export * as storage from "~/hooks/model/proposal/storage";
export * as software from "~/hooks/model/proposal/software";
