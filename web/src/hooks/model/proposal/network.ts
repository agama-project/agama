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

import { useSuspenseQuery } from "@tanstack/react-query";
import { Connection, NetworkProposal, GeneralState } from "~/types/network";
import { network, Proposal } from "~/model/proposal";
import { proposalQuery } from "~/hooks/model/proposal";

const useState = (): GeneralState => {
  const { data } = useSuspenseQuery({
    ...proposalQuery,
    select: (d) => {
      return d.network.state;
    },
  });

  return data;
};

const selectConnections = (data: network.Proposal): Connection[] =>
  data.connections.map((c) => Connection.fromApi(c));

const useProposal = (): NetworkProposal => {
  const { data } = useSuspenseQuery({
    ...proposalQuery,
    select: (d: Proposal) => NetworkProposal.fromApi(d.network),
  });

  return data;
};

const useConnections = (): Connection[] => {
  const { data } = useSuspenseQuery({
    ...proposalQuery,
    select: (d: Proposal) => selectConnections(d.network),
  });
  return data;
};

const useConnection = (name: string) => {
  const connection = useConnections().find((c) => c.id === name);

  return connection;
};

export { useConnection, useConnections, useProposal, useState };
