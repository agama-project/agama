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

import React, { useCallback } from "react";
import { useSuspenseQuery, useQueryClient } from "@tanstack/react-query";
import { getIssues } from "~/api";
import { useInstallerClient } from "~/context/installer";
import { Issue, Scope } from "~/api/issue";

const issuesQuery = {
  queryKey: ["issues"],
  queryFn: getIssues,
};

function useIssues(scope?: Scope): Issue[] {
  const { data } = useSuspenseQuery({
    ...issuesQuery,
    select: useCallback(
      (data: Issue[]): Issue[] => (scope ? data.filter((i: Issue) => i.scope === scope) : data),
      [scope],
    ),
  });
  return data;
}

const useIssuesChanges = () => {
  const queryClient = useQueryClient();
  const client = useInstallerClient();

  React.useEffect(() => {
    if (!client) return;

    return client.onEvent((event) => {
      if (event.type === "IssuesChanged") {
        queryClient.invalidateQueries({ queryKey: ["issues"] });
      }
    });
  }, [client, queryClient]);
};

export { issuesQuery, useIssues, useIssuesChanges };
