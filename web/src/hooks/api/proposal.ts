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
import type { Proposal } from "~/api/proposal";

const proposalQuery = {
  queryKey: ["proposal"],
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
        queryClient.invalidateQueries({ queryKey: ["extendedConfig"] });
        queryClient.invalidateQueries({ queryKey: ["storageModel"] });
        queryClient.invalidateQueries({ queryKey: ["proposal"] });
      }
    });
  }, [client, queryClient]);
}

export { proposalQuery, useProposal, useProposalChanges };
export * as l10n from "~/hooks/api/proposal/l10n";
export * as network from "~/hooks/api/proposal/network";
export * as storage from "~/hooks/api/proposal/storage";
export * as software from "~/hooks/api/proposal/software";
