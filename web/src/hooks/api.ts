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
import { useQuery, useSuspenseQuery, useQueryClient } from "@tanstack/react-query";
import {
  getConfig,
  getSystem,
  getProposal,
  getExtendedConfig,
  solveStorageModel,
  getStorageModel,
  getQuestions,
  getIssues,
  getStatus,
} from "~/api";
import { useInstallerClient } from "~/context/installer";
import { System } from "~/api/system";
import { Proposal } from "~/api/proposal";
import { Status } from "~/api/status";
import { Config } from "~/api/config";
import { apiModel } from "~/api/storage";
import { Question } from "~/api/question";
import { IssuesScope, Issue, IssuesMap } from "~/api/issue";
import { QueryHookOptions } from "~/types/queries";

const statusQuery = () => ({
  queryKey: ["status"],
  queryFn: getStatus,
});

const systemQuery = () => ({
  queryKey: ["system"],
  queryFn: getSystem,
});

function useStatus(options?: QueryHookOptions): Status | null {
  const func = options?.suspense ? useSuspenseQuery : useQuery;
  const { data } = func(statusQuery());
  return data;
}

function useSystem(options?: QueryHookOptions): System | null {
  const func = options?.suspense ? useSuspenseQuery : useQuery;
  const { data } = func(systemQuery());
  return data;
}

function useSystemChanges() {
  const queryClient = useQueryClient();
  const client = useInstallerClient();

  React.useEffect(() => {
    if (!client) return;

    // TODO: replace the scope instead of invalidating the query.
    return client.onEvent((event) => {
      if (event.type === "SystemChanged") {
        queryClient.invalidateQueries({ queryKey: ["system"] });
        if (event.scope === "storage")
          queryClient.invalidateQueries({ queryKey: ["solvedStorageModel"] });
      }
    });
  }, [client, queryClient]);
}

const proposalQuery = () => {
  return {
    queryKey: ["proposal"],
    queryFn: getProposal,
  };
};

function useProposal(options?: QueryHookOptions): Proposal | null {
  const func = options?.suspense ? useSuspenseQuery : useQuery;
  const { data } = func(proposalQuery());
  return data;
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

const configQuery = () => ({
  queryKey: ["configQuery"],
  queryFn: getConfig,
});

function useConfig(options?: QueryHookOptions): Config | null {
  const query = configQuery();
  const func = options?.suspense ? useSuspenseQuery : useQuery;
  return func(query)?.data;
}

const extendedConfigQuery = () => ({
  queryKey: ["extendedConfig"],
  queryFn: getExtendedConfig,
});

function useExtendedConfig(options?: QueryHookOptions): Config | null {
  const query = extendedConfigQuery();
  const func = options?.suspense ? useSuspenseQuery : useQuery;
  return func(query)?.data;
}

const questionsQuery = () => ({
  queryKey: ["questions"],
  queryFn: getQuestions,
});

const useQuestions = (options?: QueryHookOptions): Question[] => {
  const func = options?.suspense ? useSuspenseQuery : useQuery;
  return func(questionsQuery())?.data || [];
};

const useQuestionsChanges = () => {
  const queryClient = useQueryClient();
  const client = useInstallerClient();

  React.useEffect(() => {
    if (!client) return;

    return client.onEvent((event) => {
      if (event.type === "QuestionAdded" || event.type === "QuestionAnswered") {
        queryClient.invalidateQueries({ queryKey: ["questions"] });
      }
    });
  }, [client, queryClient]);

  React.useEffect(() => {
    if (!client) return;

    return client.onConnect(() => {
      queryClient.invalidateQueries({ queryKey: ["questions"] });
    });
  }, [client, queryClient]);
};

const useSelectedProduct = (options: QueryHookOptions = { suspense: true }) => {
  const { products } = useSystem(options);
  const { product } = useExtendedConfig(options);

  if (!product) return undefined;

  return products.find((p) => (p.id = product.id));
};

const storageModelQuery = () => ({
  queryKey: ["storageModel"],
  queryFn: getStorageModel,
});

function useStorageModel(options?: QueryHookOptions): apiModel.Config | null {
  const query = storageModelQuery();
  const func = options?.suspense ? useSuspenseQuery : useQuery;
  return func(query)?.data;
}

const solvedStorageModelQuery = (apiModel?: apiModel.Config) => ({
  queryKey: ["solvedStorageModel", JSON.stringify(apiModel)],
  queryFn: () => (apiModel ? solveStorageModel(apiModel) : Promise.resolve(null)),
  staleTime: Infinity,
});

function useSolvedStorageModel(
  model?: apiModel.Config,
  options?: QueryHookOptions,
): apiModel.Config | null {
  const query = solvedStorageModelQuery(model);
  const func = options?.suspense ? useSuspenseQuery : useQuery;
  return func(query)?.data;
}

const issuesQuery = () => {
  return {
    queryKey: ["issues"],
    queryFn: getIssues,
  };
};

const selectIssues = (data: IssuesMap | null): Issue[] => {
  if (!data) return [];

  return Object.keys(data).reduce((all: Issue[], key: IssuesScope) => {
    const scoped = data[key].map((i) => ({ ...i, scope: key }));
    return all.concat(scoped);
  }, []);
};

function useIssues(options?: QueryHookOptions): Issue[] {
  const func = options?.suspense ? useSuspenseQuery : useQuery;
  const { data } = func({
    ...issuesQuery(),
    select: selectIssues,
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

function useScopeIssues(scope: IssuesScope, options?: QueryHookOptions): Issue[] {
  const func = options?.suspense ? useSuspenseQuery : useQuery;
  const { data } = func({
    ...issuesQuery(),
    select: useCallback(
      (data: IssuesMap | null): Issue[] =>
        selectIssues(data).filter((i: Issue) => i.scope === scope),
      [scope],
    ),
  });
  return data;
}

export {
  systemQuery,
  proposalQuery,
  extendedConfigQuery,
  storageModelQuery,
  issuesQuery,
  selectIssues,
  useConfig,
  useSystem,
  useStatus,
  useSystemChanges,
  useProposal,
  useProposalChanges,
  useExtendedConfig,
  useQuestions,
  useQuestionsChanges,
  useStorageModel,
  useSolvedStorageModel,
  useIssues,
  useScopeIssues,
  useIssuesChanges,
  useSelectedProduct,
};
