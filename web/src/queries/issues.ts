/*
 * Copyright (c) [2024] SUSE LLC
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
import { useQueryClient, useSuspenseQueries, useSuspenseQuery } from "@tanstack/react-query";
import { useInstallerClient } from "~/context/installer";
import { IssuesList, IssuesScope, IssueSeverity, IssueSource } from "~/types/issues";
import { fetchIssues } from "~/api/issues";

const scopesFromPath = {
  "/org/opensuse/Agama/Software1": "software",
  "/org/opensuse/Agama/Software1/Product": "product",
  "/org/opensuse/Agama/Storage1": "storage",
  "/org/opensuse/Agama/Users1": "users",
};

const issuesKeys = {
  all: () => ["issues"] as const,
  byScope: (scope: IssuesScope) => [...issuesKeys.all(), scope] as const,
};

const issuesQuery = (scope: IssuesScope) => {
  return {
    queryKey: issuesKeys.byScope(scope),
    queryFn: () => fetchIssues(scope),
  };
};

/**
 * Returns the issues for the given scope.
 *
 * @param scope - Scope to get the issues from.
 * @return issues for the given scope.
 */
const useIssues = (scope: IssuesScope) => {
  const { data } = useSuspenseQuery(issuesQuery(scope));
  return data;
};

const useAllIssues = () => {
  const queries = [
    issuesQuery("product"),
    issuesQuery("software"),
    issuesQuery("storage"),
    issuesQuery("users"),
  ];

  const [{ data: product }, { data: software }, { data: storage }, { data: users }] =
    useSuspenseQueries({ queries });
  return new IssuesList(product, software, storage, users);
};

const useIssuesChanges = () => {
  const queryClient = useQueryClient();
  const client = useInstallerClient();

  React.useEffect(() => {
    if (!client) return;

    return client.onEvent((event) => {
      if (event.type === "IssuesChanged") {
        const path = event.path;
        const scope = scopesFromPath[path];
        // TODO: use setQueryData because all the issues are included in the event
        if (scope) {
          queryClient.invalidateQueries({ queryKey: issuesKeys.byScope(scope) });
        } else {
          console.warn(`Unknown scope ${path}`);
        }
      }
    });
  }, [client, queryClient]);
};

/**
 * Returns the system errors for the given scope.
 */
const useSystemErrors = (scope: IssuesScope) => {
  const issues = useIssues(scope);

  return issues
    .filter((i) => i.severity === IssueSeverity.Error)
    .filter((i) => i.source === IssueSource.System);
};

/**
 * Returns the config errors for the given scope.
 */
const useConfigErrors = (scope: IssuesScope) => {
  const issues = useIssues(scope);

  return issues
    .filter((i) => i.severity === IssueSeverity.Error)
    .filter((i) => i.source === IssueSource.Config);
};

export { useIssues, useAllIssues, useIssuesChanges, useSystemErrors, useConfigErrors };
