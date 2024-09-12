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

import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import React from "react";
import { fetchInitiator, fetchNodes, updateInitiator } from "~/api/storage/iscsi";
import { ISCSIInitiator } from "~/types/storage";
import { useInstallerClient } from "~/context/installer";
import { ISCSINode } from "~/api/storage/types";

const initiatorQuery = {
  queryKey: ["storage", "iscsi", "initiator"],
  queryFn: async (): Promise<ISCSIInitiator> => {
    const initiator = await fetchInitiator();
    // FIXME: what is the offloadCard?
    return { ...initiator, offloadCard: "" };
  },
};

const useInitiator = (): ISCSIInitiator => {
  const { data } = useSuspenseQuery(initiatorQuery);
  return data;
};

const useInitiatorMutation = () => {
  const queryClient = useQueryClient();
  const query = {
    mutationFn: ({ name }) => updateInitiator({ name }),
    // TODO: update the name if the query already contains data
    onSuccess: () => queryClient.invalidateQueries({ queryKey: initiatorQuery.queryKey }),
  };
  return useMutation(query);
};

const useInitiatorChanges = () => {
  const client = useInstallerClient();
  const queryClient = useQueryClient();
  React.useEffect(() => {
    if (!client) return;

    return client.ws().onEvent(({ type, name, value }) => {
      if (type === "ISCSIInitiatorChanged") {
        queryClient.invalidateQueries({ queryKey: initiatorQuery.queryKey });
      }
    });
  }, [client, queryClient]);
};

const nodesQuery = {
  queryKey: ["storage", "iscsi", "nodes"],
  queryFn: fetchNodes,
};

const useNodes = (): ISCSINode[] => {
  const { data } = useSuspenseQuery(nodesQuery);
  return data;
};

const useNodesChanges = () => {
  const client = useInstallerClient();
  const queryClient = useQueryClient();

  React.useEffect(() => {
    if (!client) return;

    return client.ws().onEvent(({ type }) => {
      if (["ISCSINodeAdded", "ISCSINodeChanged", "ISCSINodeRemoved"].includes(type)) {
        // FIXME: update with the information coming from the signal
        queryClient.invalidateQueries({ queryKey: nodesQuery.queryKey });
      }
    });
  }, [client, queryClient]);
};

export { useInitiator, useInitiatorMutation, useInitiatorChanges, useNodes, useNodesChanges };
