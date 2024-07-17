/*
 * Copyright (c) [2024] SUSE LLC
 *
 * All Rights Reserved.
 *
 * This program is free software; you can redistribute it and/or modify it
 * under the terms of version 2 of the GNU General Public License as published
 * by the Free Software Foundation.
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
import {
  useQueries,
  useQuery,
  useQueryClient,
  useSuspenseQueries,
  useSuspenseQuery,
} from "@tanstack/react-query";
import { useInstallerClient } from "~/context/installer";
import { Issue, IssuesList } from "~/types/issues";

type IssuesScope = "product" | "software" | "storage" | "users";

const URLS = {
  product: "software/issues/product",
  software: "software/issues/software",
  users: "users/issues",
  storage: "storage/issues",
};

const scopesFromPath = {
  "/org/opensuse/Agama/Software1": "software",
  "/org/opensuse/Agama/Software1/Product": "product",
  "/org/opensuse/Agama/Storage1": "storage",
  "/org/opensuse/Agama/Users1": "users",
};

const issuesQuery = (scope: IssuesScope) => {
  return {
    queryKey: ["issues", scope],
    queryFn: () => fetch(`/api/${URLS[scope]}`).then((res) => res.json()),
  };
};

/**
 * Returns the issues for the given scope.
 *
 * @param {IssuesScope} scope - Scope to get the issues from.
 * @return {Issue[]}
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
  const list = {
    product: product as Issue[],
    software: software as Issue[],
    storage: storage as Issue[],
    users: users as Issue[],
  };
  return new IssuesList(product, software, storage, users);
};

const useIssuesChanges = () => {
  const queryClient = useQueryClient();
  const client = useInstallerClient();

  React.useEffect(() => {
    if (!client) return;

    return client.ws().onEvent((event) => {
      if (event.type === "IssuesChanged") {
        const path = event.path;
        const scope = scopesFromPath[path];
        // TODO: use setQueryData because all the issues are included in the event
        if (scope) {
          queryClient.invalidateQueries({ queryKey: ["issues", scope] });
        } else {
          console.warn(`Unknown scope ${path}`);
        }
      }
    });
  }, [client, queryClient]);
};

export { useIssues, useAllIssues, useIssuesChanges };
