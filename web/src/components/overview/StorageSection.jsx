/*
 * Copyright (c) [2022-2023] SUSE LLC
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

import React, { useReducer, useEffect } from "react";
import { useCancellablePromise } from "~/utils";
import { useInstallerClient } from "~/context/installer";
import { BUSY } from "~/client/status";
import { SectionSkeleton, Section } from "~/components/core";
import { ProposalSummary } from "~/components/storage";

const initialState = {
  busy: true,
  proposal: undefined,
  errors: []
};

const reducer = (state, action) => {
  switch (action.type) {
    case "UPDATE_STATUS": {
      return { ...initialState, busy: action.payload.status === BUSY };
    }

    case "UPDATE_PROPOSAL": {
      if (state.busy) return state;

      const { proposal, errors } = action.payload;

      return { ...state, proposal, errors };
    }

    default: {
      return state;
    }
  }
};

export default function StorageSection({ showErrors }) {
  const client = useInstallerClient();
  const { cancellablePromise } = useCancellablePromise();
  const [state, dispatch] = useReducer(reducer, initialState);

  useEffect(() => {
    const updateStatus = (status) => {
      dispatch({ type: "UPDATE_STATUS", payload: { status } });
    };

    cancellablePromise(client.storage.getStatus()).then(updateStatus);

    return client.storage.onStatusChange(updateStatus);
  }, [client.storage, cancellablePromise]);

  useEffect(() => {
    const updateProposal = async () => {
      const proposal = await cancellablePromise(client.storage.proposal.getData());
      const errors = await cancellablePromise(client.storage.getValidationErrors());

      dispatch({ type: "UPDATE_PROPOSAL", payload: { proposal, errors } });
    };

    updateProposal();
  }, [client.storage, cancellablePromise, state.busy]);

  const errors = showErrors ? state.errors : [];

  const busy = state.busy || !state.proposal;

  return (
    <Section
      key="storage-section"
      title="Storage"
      path="/storage"
      icon="hard_drive"
      loading={busy}
      errors={errors}
    >
      { busy ? <SectionSkeleton /> : <ProposalSummary proposal={state.proposal} /> }
    </Section>
  );
}
