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

import { useSuspenseQuery, useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { proposalQuery } from "~/hooks/api";
import { Connection, NetworkConfig, NetworkProposal } from "~/types/network";
import { QueryHookOptions } from "~/types/queries";
import { network, Proposal } from "~/api/proposal";
import { Config } from "~/api/config";
import { Config as APIConfig } from "~/api/network/config";
import { patchConfig } from "~/api";

/**
 * Hook that builds a mutation to update a network connection
 *
 * It does not require to call `useMutation`.
 */
const useConnectionMutation = () => {
  const queryClient = useQueryClient();
  const query = {
    mutationFn: (newConnection: Connection) => {
      const config: APIConfig = { connections: [newConnection.toApi()] };
      const networkConfig: Config = { network: config };
      return patchConfig(networkConfig);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["proposal"] });
    },
  };
  return useMutation(query);
};
/**
 * Hook that builds a mutation to update a network connection
 *
 * It does not require to call `useMutation`.
 */
const useConfigMutation = () => {
  const queryClient = useQueryClient();
  const query = {
    mutationFn: patchConfig,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["proposal"] });
    },
  };
  return useMutation(query);
};

const selectConnections = (data: network.Proposal): Connection[] =>
  data.connections.map((c) => Connection.fromApi(c));

const useConfig = (options?: QueryHookOptions): NetworkProposal => {
  const func = options?.suspense ? useSuspenseQuery : useQuery;
  const { data } = func({
    ...configQuery(),
    select: (d: Proposal) => NetworkConfig.fromApi(d.network),
  });

  return data;
};

const useConnections = (options?: QueryHookOptions): Connection[] => {
  const func = options?.suspense ? useSuspenseQuery : useQuery;
  const { data } = func({
    ...proposalQuery(),
    select: (d: Proposal) => selectConnections(d.network),
  });
  return data;
};

const useConnection = (name: string) => {
  const connection = useConnections().find((c) => c.id === name);

  return connection;
};

export { useConnectionMutation, useConfigMutation, useConnection, useConnections, useConfig };
