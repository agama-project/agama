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
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { fetchInitiator, fetchNodes, updateInitiator } from "~/api/storage/iscsi";
import { ISCSIInitiator } from "~/types/storage";
import { useInstallerClient } from "~/context/installer";
import { ISCSINode } from "~/api/storage/types";
import { storageKeys } from "../storage";

// FIXME: move this to sotaraKeys factory?
const storageIscsiKeys = {
  all: () => ["storage", "iscsi"] as const,
  initiator: () => [...storageKeys.all(), "initiator"] as const,
  nodes: () => [...storageKeys.all(), "nodes"] as const,
};

const initiatorQuery = {
  queryKey: storageIscsiKeys.initiator(),
  queryFn: async (): Promise<ISCSIInitiator> => {
    const initiator = await fetchInitiator();
    return initiator;
  },
};

/**
 * Hook that returns the information about the ISCSI initiator.
 *
 * This hook uses the Suspense API.
 */
const useInitiator = (): ISCSIInitiator => {
  const { data } = useSuspenseQuery(initiatorQuery);
  return data;
};

/**
 * Hook that builds a mutation to update the initiator information.
 */
const useInitiatorMutation = () => {
  const queryClient = useQueryClient();
  const query = {
    mutationFn: ({ name }) => updateInitiator({ name }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: storageIscsiKeys.initiator() }),
  };
  return useMutation(query);
};

/**
 * Subscribes to ISCSI initiator changes to keep the data up-to-date.
 */
const useInitiatorChanges = () => {
  const client = useInstallerClient();
  const queryClient = useQueryClient();
  React.useEffect(() => {
    if (!client) return;

    return client.onEvent(({ type, name, ibft }) => {
      if (type !== "ISCSIInitiatorChanged") return;

      queryClient.setQueryData(
        storageIscsiKeys.initiator(),
        (oldData: ISCSIInitiator | undefined) => {
          if (oldData === undefined) return;

          return {
            name: name === null ? oldData.name : name,
            ibft: ibft === null ? oldData.ibft : ibft,
          };
        },
      );
    });
  }, [client, queryClient]);
};

const nodesQuery = {
  queryKey: storageIscsiKeys.nodes(),
  queryFn: fetchNodes,
};

const useNodes = (): ISCSINode[] => {
  const { data } = useSuspenseQuery(nodesQuery);
  return data;
};

/**
 * Subscribes to ISCSI nodes changes to keep the query up-to-date.
 */
const useNodesChanges = () => {
  const client = useInstallerClient();
  const queryClient = useQueryClient();

  React.useEffect(() => {
    if (!client) return;

    return client.onEvent(({ type, node }) => {
      if (!["ISCSINodeAdded", "ISCSINodeChanged", "ISCSINodeRemoved"].includes(type)) {
        return;
      }

      queryClient.setQueryData(storageIscsiKeys.nodes(), (oldData: ISCSINode[] | undefined) => {
        if (oldData === undefined) return;

        switch (type) {
          case "ISCSINodeAdded": {
            return [...oldData, node];
          }
          case "ISCSINodeChanged": {
            return oldData.map((n) => (n.id === node.id ? node : n));
          }
          case "ISCSINodeRemoved": {
            return oldData.filter((n) => n.id !== node.id);
          }
        }
      });
    });
  }, [client, queryClient]);
};

export { useInitiator, useInitiatorMutation, useInitiatorChanges, useNodes, useNodesChanges };
